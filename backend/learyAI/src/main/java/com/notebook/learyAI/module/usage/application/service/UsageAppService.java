// Responsibility: Orchestrate usage reservation, settlement, and query flows on top of event truth and Redis state.
package com.notebook.learyAI.module.usage.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.SubscriptionCycle;
import com.notebook.learyAI.module.usage.domain.model.UsageEvent;
import com.notebook.learyAI.module.usage.domain.model.UsageReservation;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import com.notebook.learyAI.module.usage.domain.policy.UsageMetricPolicy;
import com.notebook.learyAI.module.usage.infrastructure.cache.UsageRedisStateStore;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageCommitOutboxJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.SubscriptionCycleJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageEventJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.SubscriptionCyclePO;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageEventPO;
import com.notebook.learyAI.shared.exception.BizException;
import jakarta.persistence.EntityManager;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class UsageAppService {
    private static final TypeReference<Map<String, String>> STRING_MAP = new TypeReference<>() {
    };

    private final UsageEventJpaRepository usageEventJpaRepository;
    private final UsageCommitOutboxJpaRepository usageCommitOutboxJpaRepository;
    private final SubscriptionCycleJpaRepository subscriptionCycleJpaRepository;
    private final UsageRedisStateStore usageRedisStateStore;
    private final ObjectMapper objectMapper;
    private final EntityManager entityManager;
    private final UsageMetricPolicy metricPolicy = new UsageMetricPolicy();
    private final Duration defaultReservationTtl;
    private static final Set<String> RUNTIME_STATE_AUTHORITATIVE_METRICS = Set.of("ai_chat_tokens");

    public UsageAppService(UsageEventJpaRepository usageEventJpaRepository,
                           UsageCommitOutboxJpaRepository usageCommitOutboxJpaRepository,
                           SubscriptionCycleJpaRepository subscriptionCycleJpaRepository,
                           UsageRedisStateStore usageRedisStateStore,
                           EntityManager entityManager,
                           ObjectMapper objectMapper,
                           @Value("${usage.reservation.default-ttl-seconds:1800}") long reservationTtlSeconds) {
        this.usageEventJpaRepository = usageEventJpaRepository;
        this.usageCommitOutboxJpaRepository = usageCommitOutboxJpaRepository;
        this.subscriptionCycleJpaRepository = subscriptionCycleJpaRepository;
        this.usageRedisStateStore = usageRedisStateStore;
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
        this.defaultReservationTtl = Duration.ofSeconds(Math.max(60L, reservationTtlSeconds));
    }

    public ReserveUsageResponseDTO reserve(ReserveUsageRequestDTO request) {
        validateReserveRequest(request);
        Instant now = Instant.now();
        String projectId = normalizeProjectId(request.projectId());
        String metric = request.metric().trim();
        SubscriptionCycle cycle = requireActiveCycle(request.userId(), metric, now);
        CurrentCycleUsage currentCycle = getCurrentCycleUsage(request.userId(), projectId, metric);
        UsageRedisStateStore.ReserveResult result = usageRedisStateStore.reserve(
                cycle,
                request.userId(),
                projectId,
                metric,
                request.reservationId().trim(),
                request.requestId().trim(),
                request.requestedAmount(),
                currentCycle.used(),
                now,
                normalizeTtl(request.reservationTtl())
        );
        if (result.conflict()) {
            throw new BizException("USAGE-409", "reservation conflict");
        }
        if (!result.success()) {
            throw new BizException("USAGE-403", "quota exceeded");
        }
        UsageReservation reservation = usageRedisStateStore.getReservation(
                request.reservationId().trim(),
                request.userId(),
                projectId,
                metric
        );
        CurrentCycleUsage refreshedCurrentCycle = getCurrentCycleUsage(request.userId(), projectId, metric);
        return new ReserveUsageResponseDTO(true, !result.idempotentReplay(), reservation, refreshedCurrentCycle);
    }

    @Transactional
    public CommitUsageResponseDTO commit(CommitUsageRequestDTO request) {
        validateCommitRequest(request);
        Instant occurredAt = request.occurredAt() == null ? Instant.now() : request.occurredAt();
        Instant now = Instant.now();
        String projectId = normalizeProjectId(request.projectId());
        String metric = request.metric().trim();
        SubscriptionCycle cycle = requireActiveCycle(request.userId(), metric, now);
        UsageEventPO savedEvent = saveEvent(request, occurredAt, now, projectId, metric);
        long usedBeforeCurrentEvent = usedInCycle(request.userId(), projectId, metric, cycle.validFrom(), cycle.validTo()) - request.actualAmount();
        long commitResult = usageRedisStateStore.commit(
                cycle,
                request.reservationId().trim(),
                request.requestId().trim(),
                request.actualAmount(),
                Math.max(0L, usedBeforeCurrentEvent),
                now
        );
        if (commitResult == -1L) {
            throw new BizException("USAGE-409", "reservation conflict");
        }
        if (savedEvent != null) {
            usageRedisStateStore.incrementRollingBuckets(request.userId(), metric, request.actualAmount(), occurredAt);
        }
        CurrentCycleUsage currentCycleUsage = getCurrentCycleUsage(request.userId(), projectId, metric);
        return new CommitUsageResponseDTO(true, savedEvent != null, toDomain(savedEvent), currentCycleUsage);
    }

    @Transactional
    CommitUsageResponseDTO appendCommittedUsageEvent(CommitUsageRequestDTO request) {
        validateCommitRequest(request);
        Instant occurredAt = request.occurredAt() == null ? Instant.now() : request.occurredAt();
        Instant now = Instant.now();
        String projectId = normalizeProjectId(request.projectId());
        String metric = request.metric().trim();
        requireActiveCycle(request.userId(), metric, occurredAt);
        UsageEventPO savedEvent = saveEvent(request, occurredAt, now, projectId, metric);
        if (savedEvent != null) {
            usageRedisStateStore.incrementRollingBuckets(request.userId(), metric, request.actualAmount(), occurredAt);
        }
        CurrentCycleUsage currentCycleUsage = getCurrentCycleUsage(request.userId(), projectId, metric);
        return new CommitUsageResponseDTO(true, savedEvent != null, toDomain(savedEvent), currentCycleUsage);
    }

    @Transactional
    public CommitUsageResponseDTO recordCommittedUsageFact(CommitUsageRequestDTO request) {
        validateCommitRequest(request);
        Instant occurredAt = request.occurredAt() == null ? Instant.now() : request.occurredAt();
        Instant now = Instant.now();
        String projectId = normalizeProjectId(request.projectId());
        String metric = request.metric().trim();
        SubscriptionCycle cycle = requireActiveCycle(request.userId(), metric, occurredAt);
        UsageEventPO savedEvent = saveEvent(request, occurredAt, now, projectId, metric);
        if (savedEvent != null) {
            usageRedisStateStore.incrementRollingBuckets(request.userId(), metric, request.actualAmount(), occurredAt);
        }
        long used = effectiveUsedInCycle(request.userId(), projectId, metric, cycle.validFrom(), cycle.validTo());
        usageRedisStateStore.writeCurrentCycleUsage(cycle, request.userId(), projectId, metric, used, 0L, now);
        CurrentCycleUsage currentCycleUsage = usageRedisStateStore.toCurrentCycleUsage(
                cycle,
                projectId,
                used,
                0L,
                cycle.quota(),
                now
        );
        return new CommitUsageResponseDTO(true, savedEvent != null, toDomain(savedEvent), currentCycleUsage);
    }

    public ReleaseUsageResponseDTO release(ReleaseUsageRequestDTO request) {
        validateReleaseRequest(request);
        Instant now = Instant.now();
        String projectId = normalizeProjectId(request.projectId());
        String metric = request.metric().trim();
        requireActiveCycle(request.userId(), metric, now);
        long result = usageRedisStateStore.release(
                request.reservationId().trim(),
                request.userId(),
                metric,
                request.requestId().trim(),
                now
        );
        if (result == -1L) {
            throw new BizException("USAGE-409", "reservation conflict");
        }
        CurrentCycleUsage currentCycleUsage = getCurrentCycleUsage(request.userId(), projectId, metric);
        return new ReleaseUsageResponseDTO(true, result == 1L, currentCycleUsage);
    }

    public CurrentCycleUsage getCurrentCycleUsage(long userId, String projectId, String metric) {
        validateQueryRequest(userId, projectId, metric);
        String normalizedProjectId = normalizeProjectId(projectId);
        String normalizedMetric = metric.trim();
        Instant now = Instant.now();
        SubscriptionCycle cycle = requireActiveCycle(userId, normalizedMetric, now);
        Optional<CurrentCycleUsage> cached = usageRedisStateStore.getCurrentCycleUsage(cycle, userId, normalizedProjectId, normalizedMetric);
        if (runtimeStateAuthoritative(normalizedMetric) && cached.isPresent()) {
            return cached.get();
        }
        long effectiveUsed = effectiveUsedInCycle(userId, normalizedProjectId, normalizedMetric, cycle.validFrom(), cycle.validTo());
        if (cached.isPresent()) {
            CurrentCycleUsage cachedUsage = cached.get();
            if (cachedUsage.used() != effectiveUsed) {
                usageRedisStateStore.writeCurrentCycleUsage(cycle, userId, normalizedProjectId, normalizedMetric, effectiveUsed, cachedUsage.reserved(), now);
                return usageRedisStateStore.toCurrentCycleUsage(
                        cycle,
                        normalizedProjectId,
                        effectiveUsed,
                        cachedUsage.reserved(),
                        cachedUsage.quota(),
                        now
                );
            }
            return cachedUsage;
        }
        usageRedisStateStore.writeCurrentCycleUsage(cycle, userId, normalizedProjectId, normalizedMetric, effectiveUsed, 0L, now);
        return usageRedisStateStore.toCurrentCycleUsage(cycle, normalizedProjectId, effectiveUsed, 0L, cycle.quota(), now);
    }

    public RollingUsage getRollingUsage(long userId, String projectId, String metric, UsageWindowType windowType) {
        validateQueryRequest(userId, projectId, metric);
        if (windowType == null) {
            throw new BizException("USAGE-400", "windowType required");
        }
        String normalizedProjectId = normalizeProjectId(projectId);
        String normalizedMetric = metric.trim();
        Instant now = Instant.now();
        Instant windowStart = resolveWindowStart(now, windowType);
        Instant windowEnd = now.truncatedTo(ChronoUnit.SECONDS);
        long used = readRollingUsage(userId, normalizedProjectId, normalizedMetric, windowType, windowStart, windowEnd);
        return new RollingUsage(userId, normalizedProjectId, normalizedMetric, windowType, used, windowStart, windowEnd, now);
    }

    private long readRollingUsage(long userId,
                                  String projectId,
                                  String metric,
                                  UsageWindowType windowType,
                                  Instant windowStart,
                                  Instant windowEnd) {
        List<String> keys = windowType == UsageWindowType.LAST_24_HOURS
                ? usageRedisStateStore.hourKeys(userId, metric, windowStart.truncatedTo(ChronoUnit.HOURS), windowEnd.truncatedTo(ChronoUnit.HOURS).plus(Duration.ofHours(1)))
                : usageRedisStateStore.dayKeys(userId, metric, windowStart.truncatedTo(ChronoUnit.DAYS), windowEnd.truncatedTo(ChronoUnit.DAYS).plus(Duration.ofDays(1)));
        long bucketTotal = usageRedisStateStore.sumRollingBuckets(userId, metric, keys);
        if (bucketTotal != Long.MIN_VALUE) {
            return bucketTotal;
        }
        return usedInCycle(userId, projectId, metric, windowStart, windowEnd);
    }

    private UsageEventPO saveEvent(CommitUsageRequestDTO request,
                                   Instant occurredAt,
                                   Instant now,
                                   String projectId,
                                   String metric) {
        Optional<UsageEventPO> existing = usageEventJpaRepository.findByIdempotencyKey(request.idempotencyKey().trim());
        if (existing.isPresent()) {
            return null;
        }
        UsageEventPO po = new UsageEventPO();
        po.setUserId(request.userId());
        po.setProjectId(projectId);
        po.setMetric(metric);
        po.setDelta(request.actualAmount());
        po.setOccurredAt(occurredAt);
        po.setIdempotencyKey(request.idempotencyKey().trim());
        po.setSourceType(request.sourceType().trim());
        po.setSourceId(request.sourceId().trim());
        po.setMetadataJson(writeMetadata(request.metadata()));
        po.setCreatedAt(now);
        try {
            return usageEventJpaRepository.save(po);
        } catch (DataIntegrityViolationException ex) {
            entityManager.clear();
            return null;
        }
    }

    private long usedInCycle(long userId, String projectId, String metric, Instant from, Instant to) {
        Long total = usageEventJpaRepository.sumDeltaByUserProjectMetricBetween(userId, projectId, metric, from, to);
        return total == null ? 0L : total;
    }

    long effectiveUsedInCycle(long userId, String projectId, String metric, Instant from, Instant to) {
        long committed = usedInCycle(userId, projectId, metric, from, to);
        Long pending = usageCommitOutboxJpaRepository.sumActualAmountByStatusAndUserProjectMetricBetween(
                UsageCommitOutboxAppService.STATUS_PENDING,
                userId,
                projectId,
                metric,
                from,
                to
        );
        long pendingDelta = pending == null ? 0L : pending;
        return Math.max(0L, committed + pendingDelta);
    }

    private boolean runtimeStateAuthoritative(String metric) {
        return RUNTIME_STATE_AUTHORITATIVE_METRICS.contains(metric);
    }

    private SubscriptionCycle requireActiveCycle(long userId, String metric, Instant now) {
        SubscriptionCyclePO po = subscriptionCycleJpaRepository.findActiveCycle(userId, metric, now)
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

    private UsageEvent toDomain(UsageEventPO po) {
        if (po == null) {
            return null;
        }
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
                readMetadata(po.getMetadataJson()),
                po.getCreatedAt()
        );
    }

    private Map<String, String> readMetadata(String metadataJson) {
        try {
            return objectMapper.readValue(metadataJson, STRING_MAP);
        } catch (JsonProcessingException ex) {
            throw new BizException("USAGE-500", "metadata parse failed");
        }
    }

    private String writeMetadata(Map<String, String> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (JsonProcessingException ex) {
            throw new BizException("USAGE-500", "metadata serialize failed");
        }
    }

    private Duration normalizeTtl(Duration ttl) {
        if (ttl == null || ttl.isZero() || ttl.isNegative()) {
            return defaultReservationTtl;
        }
        return ttl;
    }

    private Instant resolveWindowStart(Instant now, UsageWindowType windowType) {
        return windowType == UsageWindowType.LAST_24_HOURS
                ? now.minus(Duration.ofHours(24))
                : now.minus(Duration.ofDays(30));
    }

    private void validateReserveRequest(ReserveUsageRequestDTO request) {
        if (request == null) {
            throw new BizException("USAGE-400", "request required");
        }
        validateQueryRequest(request.userId(), request.projectId(), request.metric());
        if (request.reservationId() == null || request.reservationId().isBlank()) {
            throw new BizException("USAGE-400", "reservationId required");
        }
        if (request.requestId() == null || request.requestId().isBlank()) {
            throw new BizException("USAGE-400", "requestId required");
        }
        if (request.requestedAmount() <= 0) {
            throw new BizException("USAGE-400", "requestedAmount invalid");
        }
    }

    void validateCommitRequestForOutbox(CommitUsageRequestDTO request) {
        if (request == null) {
            throw new BizException("USAGE-400", "request required");
        }
        validateQueryRequest(request.userId(), request.projectId(), request.metric());
        if (request.reservationId() == null || request.reservationId().isBlank()) {
            throw new BizException("USAGE-400", "reservationId required");
        }
        if (request.requestId() == null || request.requestId().isBlank()) {
            throw new BizException("USAGE-400", "requestId required");
        }
        if (request.idempotencyKey() == null || request.idempotencyKey().isBlank()) {
            throw new BizException("USAGE-400", "idempotencyKey required");
        }
        if (request.actualAmount() == 0) {
            throw new BizException("USAGE-400", "actualAmount invalid");
        }
        if (request.sourceType() == null || request.sourceType().isBlank()) {
            throw new BizException("USAGE-400", "sourceType required");
        }
        if (request.sourceId() == null || request.sourceId().isBlank()) {
            throw new BizException("USAGE-400", "sourceId required");
        }
    }

    private void validateCommitRequest(CommitUsageRequestDTO request) {
        validateCommitRequestForOutbox(request);
    }

    private void validateReleaseRequest(ReleaseUsageRequestDTO request) {
        if (request == null) {
            throw new BizException("USAGE-400", "request required");
        }
        validateQueryRequest(request.userId(), request.projectId(), request.metric());
        if (request.reservationId() == null || request.reservationId().isBlank()) {
            throw new BizException("USAGE-400", "reservationId required");
        }
        if (request.requestId() == null || request.requestId().isBlank()) {
            throw new BizException("USAGE-400", "requestId required");
        }
    }

    private void validateQueryRequest(long userId, String projectId, String metric) {
        if (userId <= 0) {
            throw new BizException("USAGE-400", "userId invalid");
        }
        if (metric == null || metric.isBlank()) {
            throw new BizException("USAGE-400", "metric required");
        }
        metricPolicy.requireValid(metric.trim());
    }

    private String normalizeProjectId(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return "";
        }
        return projectId.trim();
    }
}
