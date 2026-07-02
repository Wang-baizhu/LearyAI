// Responsibility: Orchestrate current-policy lookup, turn leases, and single-call quota control.
package com.notebook.learyAI.module.usage.application.service;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.SubscriptionCycle;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;
import com.notebook.learyAI.module.usage.domain.model.UsageEvent;
import com.notebook.learyAI.module.usage.domain.model.UsagePolicyMode;
import com.notebook.learyAI.module.usage.infrastructure.cache.UsageRedisStateStore;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.SubscriptionCycleJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageEventJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.SubscriptionCyclePO;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageEventPO;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageControl;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class UsageControlAppService {
    private final UsageAppService usageAppService;
    private final UsageCommitOutboxAppService usageCommitOutboxAppService;
    private final SubscriptionCycleJpaRepository subscriptionCycleJpaRepository;
    private final UsageEventJpaRepository usageEventJpaRepository;
    private final UsageRedisStateStore usageRedisStateStore;
    private final Set<String> memberPlanIds;

    public UsageControlAppService(UsageAppService usageAppService,
                                  UsageCommitOutboxAppService usageCommitOutboxAppService,
                                  SubscriptionCycleJpaRepository subscriptionCycleJpaRepository,
                                  UsageEventJpaRepository usageEventJpaRepository,
                                  UsageRedisStateStore usageRedisStateStore,
                                  @Value("${usage.control.member-plan-ids:pro,plus}") String memberPlanIds) {
        this.usageAppService = usageAppService;
        this.usageCommitOutboxAppService = usageCommitOutboxAppService;
        this.subscriptionCycleJpaRepository = subscriptionCycleJpaRepository;
        this.usageEventJpaRepository = usageEventJpaRepository;
        this.usageRedisStateStore = usageRedisStateStore;
        this.memberPlanIds = Arrays.stream(memberPlanIds.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .collect(Collectors.toSet());
    }

    public CurrentUsagePolicy getCurrentPolicy(long userId, String projectId, String metric) {
        validateBaseRequest(userId, projectId, metric);
        String normalizedProjectId = normalizeProjectId(projectId);
        Optional<SubscriptionCycle> cycleOptional = findActiveCycle(userId, metric, Instant.now());
        if (cycleOptional.isEmpty()) {
            return defaultNonMemberPolicy(userId, normalizedProjectId, metric.trim());
        }
        SubscriptionCycle cycle = cycleOptional.get();
        CurrentCycleUsage currentCycle = usageAppService.getCurrentCycleUsage(userId, normalizedProjectId, metric);
        return toCurrentPolicy(cycle, currentCycle);
    }

    public UsageControl.OpenTurnLeaseResult openTurnLease(long userId,
                                                          String projectId,
                                                          String metric,
                                                          String turnId,
                                                          String leaseId,
                                                          String idempotencyKey,
                                                          long leaseTtlSeconds,
                                                          Map<String, String> metadata) {
        validateLeaseRequest(userId, projectId, metric, turnId, leaseId, idempotencyKey);
        String normalizedProjectId = normalizeProjectId(projectId);
        Instant now = Instant.now();
        SubscriptionCycle cycle = requireActiveCycle(userId, metric, now);
        CurrentCycleUsage currentCycle = usageAppService.getCurrentCycleUsage(userId, normalizedProjectId, metric);
        CurrentUsagePolicy currentPolicy = toCurrentPolicy(cycle, currentCycle);
        UsageRedisStateStore.OpenTurnLeaseResult result = usageRedisStateStore.openTurnLease(
                cycle,
                normalizedProjectId,
                turnId.trim(),
                leaseId.trim(),
                idempotencyKey.trim(),
                Math.max(60L, leaseTtlSeconds),
                currentCycle.used(),
                currentCycle.reserved(),
                now,
                metadata == null ? Map.of() : metadata
        );
        if (result.conflict()) {
            throw new BizException("USAGE-409-LEASE", "turn lease conflict");
        }
        if (!result.success()) {
            throw new BizException("USAGE-403-TURN", "turn lease denied");
        }
        TurnLease lease = requireTurnLease(leaseId.trim());
        return new UsageControl.OpenTurnLeaseResult(!result.idempotentReplay(), lease, currentPolicy);
    }

    @Transactional
    public UsageControl.CommitTurnCallUsageResult commitTurnCallUsage(long userId,
                                                                      String projectId,
                                                                      String metric,
                                                                      String leaseId,
                                                                      String turnId,
                                                                      String callId,
                                                                      long actualAmount,
                                                                      String idempotencyKey,
                                                                      String sourceType,
                                                                      String sourceId,
                                                                      Map<String, String> metadata,
                                                                      String occurredAt) {
        validateTurnCallRequest(userId, projectId, metric, leaseId, turnId, callId, actualAmount, idempotencyKey, sourceType, sourceId);
        String normalizedProjectId = normalizeProjectId(projectId);
        Instant now = Instant.now();
        Instant eventOccurredAt = parseOccurredAt(occurredAt, now);
        SubscriptionCycle cycle = requireActiveCycle(userId, metric, now);
        TurnLease lease = requireTurnLease(leaseId.trim());
        if (!"OPEN".equals(lease.status())) {
            throw new BizException("USAGE-409-LEASE", "turn lease not open");
        }
        Optional<UsageEventPO> existingEvent = usageEventJpaRepository.findByIdempotencyKey(idempotencyKey.trim());
        if (existingEvent.isPresent()) {
            CurrentCycleUsage currentCycle = usageAppService.getCurrentCycleUsage(userId, projectId, metric);
            return new UsageControl.CommitTurnCallUsageResult(
                    false,
                    lease,
                    toCurrentPolicy(cycle, currentCycle),
                    toUsageEvent(existingEvent.get())
            );
        }
        UsageRedisStateStore.CommitTurnCallResult redisResult = usageRedisStateStore.commitTurnCallUsage(
                cycle,
                leaseId.trim(),
                turnId.trim(),
                callId.trim(),
                actualAmount,
                currentUsedInCycle(userId, normalizedProjectId, metric.trim(), cycle),
                now
        );
        if (redisResult.conflict()) {
            throw new BizException("USAGE-409-CALL", "turn call conflict");
        }
        if (!redisResult.success()) {
            throw new BizException("USAGE-403-CALL", "turn call denied");
        }
        CommitUsageRequestDTO commitRequest = new CommitUsageRequestDTO(
                userId,
                normalizedProjectId,
                metric.trim(),
                leaseId.trim(),
                callId.trim(),
                actualAmount,
                actualAmount,
                idempotencyKey.trim(),
                sourceType.trim(),
                sourceId.trim(),
                metadata == null ? Map.of() : metadata,
                eventOccurredAt
        );
        usageCommitOutboxAppService.enqueueAppendUsageEvent(commitRequest);
        CurrentCycleUsage currentCycle = usageAppService.getCurrentCycleUsage(userId, normalizedProjectId, metric);
        return new UsageControl.CommitTurnCallUsageResult(
                !redisResult.idempotentReplay(),
                requireTurnLease(leaseId.trim()),
                toCurrentPolicy(cycle, currentCycle),
                null
        );
    }

    public UsageControl.CloseTurnLeaseResult closeTurnLease(long userId,
                                                            String leaseId,
                                                            String turnId,
                                                            String idempotencyKey,
                                                            String finalStatus) {
        if (userId <= 0 || blank(leaseId) || blank(turnId) || blank(idempotencyKey)) {
            throw new BizException("USAGE-400", "lease close request invalid");
        }
        UsageRedisStateStore.CloseTurnLeaseResult result = usageRedisStateStore.closeTurnLease(
                userId,
                leaseId.trim(),
                turnId.trim(),
                idempotencyKey.trim(),
                finalStatus,
                Instant.now()
        );
        if (result.conflict()) {
            throw new BizException("USAGE-409-LEASE", "turn lease conflict");
        }
        TurnLease lease = usageRedisStateStore.getTurnLease(leaseId.trim());
        return new UsageControl.CloseTurnLeaseResult(result.changed(), lease);
    }

    public TurnLease getTurnLease(String leaseId) {
        if (blank(leaseId)) {
            throw new BizException("USAGE-400", "leaseId required");
        }
        TurnLease lease = usageRedisStateStore.getTurnLease(leaseId.trim());
        if (lease == null) {
            throw new BizException("USAGE-404", "turn lease not found");
        }
        return lease;
    }

    public UsageControl.ReserveSingleCallResult reserveSingleCall(long userId,
                                                                  String projectId,
                                                                  String metric,
                                                                  String reservationId,
                                                                  String requestId,
                                                                  long requestedAmount,
                                                                  long reservationTtlSeconds,
                                                                  Map<String, String> metadata) {
        ensureActiveCycleOrDenyCall(userId, metric);
        ReserveUsageResponseDTO response = usageAppService.reserve(new ReserveUsageRequestDTO(
                userId,
                projectId,
                metric,
                reservationId,
                requestId,
                requestedAmount,
                Duration.ofSeconds(Math.max(60L, reservationTtlSeconds)),
                metadata == null ? Map.of() : metadata
        ));
        CurrentUsagePolicy currentPolicy = getCurrentPolicy(userId, projectId, metric);
        return new UsageControl.ReserveSingleCallResult(response, currentPolicy);
    }

    public UsageControl.CommitSingleCallResult commitSingleCall(long userId,
                                                                String projectId,
                                                                String metric,
                                                                String reservationId,
                                                                String requestId,
                                                                long requestedAmount,
                                                                long actualAmount,
                                                                String idempotencyKey,
                                                                String sourceType,
                                                                String sourceId,
                                                                Map<String, String> metadata,
                                                                String occurredAt) {
        ensureActiveCycleOrDenyCall(userId, metric);
        CommitUsageRequestDTO commitRequest = new CommitUsageRequestDTO(
                userId,
                projectId,
                metric,
                reservationId,
                requestId,
                requestedAmount,
                actualAmount,
                idempotencyKey,
                sourceType,
                sourceId,
                metadata == null ? Map.of() : metadata,
                parseOccurredAt(occurredAt, Instant.now())
        );
        SubscriptionCycle cycle = requireActiveCycle(userId, metric, Instant.now());
        long commitResult = usageRedisStateStore.commit(
                cycle,
                reservationId.trim(),
                requestId.trim(),
                actualAmount,
                usageAppService.getCurrentCycleUsage(userId, projectId, metric).used(),
                Instant.now()
        );
        if (commitResult == -1L) {
            throw new BizException("USAGE-409", "reservation conflict");
        }
        usageCommitOutboxAppService.enqueueAppendUsageEvent(commitRequest);
        CurrentUsagePolicy currentPolicy = getCurrentPolicy(userId, projectId, metric);
        return new UsageControl.CommitSingleCallResult(
                new CommitUsageResponseDTO(true, commitResult == 1L, null, toCurrentCycle(currentPolicy)),
                currentPolicy
        );
    }

    public UsageControl.ReleaseSingleCallResult releaseSingleCall(long userId,
                                                                  String projectId,
                                                                  String metric,
                                                                  String reservationId,
                                                                  String requestId) {
        ensureActiveCycleOrDenyCall(userId, metric);
        ReleaseUsageResponseDTO response = usageAppService.release(new ReleaseUsageRequestDTO(
                userId,
                projectId,
                metric,
                reservationId,
                requestId
        ));
        CurrentUsagePolicy currentPolicy = getCurrentPolicy(userId, projectId, metric);
        return new UsageControl.ReleaseSingleCallResult(response, currentPolicy);
    }

    private void validateBaseRequest(long userId, String projectId, String metric) {
        if (userId <= 0 || blank(metric)) {
            throw new BizException("USAGE-400", "usage control request invalid");
        }
    }

    private void validateLeaseRequest(long userId, String projectId, String metric, String turnId, String leaseId, String idempotencyKey) {
        validateBaseRequest(userId, projectId, metric);
        if (blank(turnId) || blank(leaseId) || blank(idempotencyKey)) {
            throw new BizException("USAGE-400", "turn lease request invalid");
        }
    }

    private void validateTurnCallRequest(long userId,
                                         String projectId,
                                         String metric,
                                         String leaseId,
                                         String turnId,
                                         String callId,
                                         long actualAmount,
                                         String idempotencyKey,
                                         String sourceType,
                                         String sourceId) {
        validateLeaseRequest(userId, projectId, metric, turnId, leaseId, idempotencyKey);
        if (blank(callId) || actualAmount <= 0 || blank(sourceType) || blank(sourceId)) {
            throw new BizException("USAGE-400", "turn call request invalid");
        }
    }

    private SubscriptionCycle requireActiveCycle(long userId, String metric, Instant now) {
        SubscriptionCyclePO po = findActiveCyclePo(userId, metric, now)
                .orElseThrow(() -> new BizException("USAGE-404", "active subscription cycle not found"));
        return new SubscriptionCycle(
                po.getId(),
                po.getUserId(),
                po.getMetric(),
                po.getPlanId(),
                po.getQuota(),
                po.getValidFrom(),
                po.getValidTo(),
                po.getStatus(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }

    private Optional<SubscriptionCycle> findActiveCycle(long userId, String metric, Instant now) {
        return findActiveCyclePo(userId, metric, now).map(po -> new SubscriptionCycle(
                po.getId(),
                po.getUserId(),
                po.getMetric(),
                po.getPlanId(),
                po.getQuota(),
                po.getValidFrom(),
                po.getValidTo(),
                po.getStatus(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        ));
    }

    private Optional<SubscriptionCyclePO> findActiveCyclePo(long userId, String metric, Instant now) {
        return subscriptionCycleJpaRepository.findActiveCycle(userId, metric.trim(), now);
    }

    private CurrentUsagePolicy toCurrentPolicy(SubscriptionCycle cycle, CurrentCycleUsage currentCycle) {
        UsagePolicyMode policyMode = memberPlanIds.contains(cycle.planId()) ? UsagePolicyMode.MEMBER : UsagePolicyMode.NON_MEMBER;
        return new CurrentUsagePolicy(
                currentCycle.userId(),
                currentCycle.projectId(),
                currentCycle.metric(),
                currentCycle.cycleId(),
                cycle.planId(),
                currentCycle.quota(),
                currentCycle.used(),
                currentCycle.reserved(),
                currentCycle.available(),
                policyMode,
                currentCycle.validFrom(),
                currentCycle.validTo(),
                currentCycle.updatedAt()
        );
    }

    private CurrentUsagePolicy defaultNonMemberPolicy(long userId, String projectId, String metric) {
        Instant now = Instant.now();
        return new CurrentUsagePolicy(
                userId,
                projectId,
                metric,
                0L,
                "",
                0L,
                0L,
                0L,
                0L,
                UsagePolicyMode.NON_MEMBER,
                now,
                now,
                now
        );
    }

    private void ensureActiveCycleOrDenyCall(long userId, String metric) {
        if (findActiveCycle(userId, metric, Instant.now()).isPresent()) {
            return;
        }
        throw new BizException("USAGE-403-CALL", "single call denied");
    }

    private TurnLease requireTurnLease(String leaseId) {
        TurnLease lease = usageRedisStateStore.getTurnLease(leaseId);
        if (lease == null) {
            throw new BizException("USAGE-404", "turn lease not found");
        }
        return lease;
    }

    private long currentUsedInCycle(long userId, String projectId, String metric, SubscriptionCycle cycle) {
        return usageAppService.effectiveUsedInCycle(userId, projectId, metric, cycle.validFrom(), cycle.validTo());
    }

    private UsageEvent toUsageEvent(UsageEventPO po) {
        return new UsageEvent(
                po.getId(),
                po.getUserId(),
                po.getProjectId(),
                po.getMetric(),
                po.getDelta(),
                po.getOccurredAt(),
                po.getIdempotencyKey(),
                po.getSourceType(),
                po.getSourceId(),
                Map.of("metadataJson", po.getMetadataJson()),
                po.getCreatedAt()
        );
    }

    private Instant parseOccurredAt(String occurredAt, Instant fallback) {
        if (blank(occurredAt)) {
            return fallback;
        }
        return Instant.parse(occurredAt.trim());
    }

    private String normalizeProjectId(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return "";
        }
        return projectId.trim();
    }

    private boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private CurrentCycleUsage toCurrentCycle(CurrentUsagePolicy policy) {
        return new CurrentCycleUsage(
                policy.userId(),
                policy.projectId(),
                policy.metric(),
                policy.cycleId(),
                policy.used(),
                policy.reserved(),
                policy.quota(),
                policy.available(),
                policy.validFrom(),
                policy.validTo(),
                policy.updatedAt()
        );
    }
}
