// Responsibility: Persist usage commit facts to local outbox and relay them to UsageAppService with retry.
package com.notebook.learyAI.module.usage.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageCommitOutboxJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageCommitOutboxPO;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class UsageCommitOutboxAppService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {
    };
    static final String EVENT_TYPE_COMMIT_USAGE = "COMMIT_USAGE";
    static final String EVENT_TYPE_APPEND_USAGE_EVENT = "APPEND_USAGE_EVENT";
    static final String STATUS_PENDING = "PENDING";
    static final String STATUS_DELIVERED = "DELIVERED";

    private final UsageCommitOutboxJpaRepository usageCommitOutboxJpaRepository;
    private final UsageAppService usageAppService;
    private final ObjectMapper objectMapper;
    private final ObjectProvider<UsageCommitOutboxAppService> selfProvider;
    private final Clock clock;
    private final int relayBatchSize;
    private final long retryDelaySeconds;

    @Autowired
    public UsageCommitOutboxAppService(UsageCommitOutboxJpaRepository usageCommitOutboxJpaRepository,
                                       UsageAppService usageAppService,
                                       ObjectMapper objectMapper,
                                       ObjectProvider<UsageCommitOutboxAppService> selfProvider,
                                       @Value("${usage.commit-outbox.relay-batch-size:100}") int relayBatchSize,
                                       @Value("${usage.commit-outbox.retry-delay-seconds:5}") long retryDelaySeconds) {
        this(usageCommitOutboxJpaRepository, usageAppService, objectMapper, selfProvider, Clock.systemUTC(), relayBatchSize, retryDelaySeconds);
    }

    UsageCommitOutboxAppService(UsageCommitOutboxJpaRepository usageCommitOutboxJpaRepository,
                                UsageAppService usageAppService,
                                ObjectMapper objectMapper,
                                ObjectProvider<UsageCommitOutboxAppService> selfProvider,
                                Clock clock,
                                int relayBatchSize,
                                long retryDelaySeconds) {
        this.usageCommitOutboxJpaRepository = usageCommitOutboxJpaRepository;
        this.usageAppService = usageAppService;
        this.objectMapper = objectMapper;
        this.selfProvider = selfProvider;
        this.clock = clock;
        this.relayBatchSize = Math.max(1, relayBatchSize);
        this.retryDelaySeconds = Math.max(1L, retryDelaySeconds);
    }

    @Transactional
    public void enqueueCommit(CommitUsageRequestDTO request) {
        usageAppService.validateCommitRequestForOutbox(request);
        String idempotencyKey = request.idempotencyKey().trim();
        UsageCommitOutboxPO outbox = usageCommitOutboxJpaRepository.findByIdempotencyKey(idempotencyKey)
                .orElseGet(() -> saveNewOutbox(request, idempotencyKey, EVENT_TYPE_COMMIT_USAGE));
        registerAfterCommitRelay(outbox.getId());
    }

    @Transactional
    public void enqueueAppendUsageEvent(CommitUsageRequestDTO request) {
        usageAppService.validateCommitRequestForOutbox(request);
        String idempotencyKey = request.idempotencyKey().trim();
        usageCommitOutboxJpaRepository.findByIdempotencyKey(idempotencyKey)
                .orElseGet(() -> saveNewOutbox(request, idempotencyKey, EVENT_TYPE_APPEND_USAGE_EVENT));
    }

    public void relayReadyBatch() {
        List<UsageCommitOutboxPO> readyRecords = usageCommitOutboxJpaRepository.findByStatusAndNextRetryAtLessThanEqualOrderByIdAsc(
                STATUS_PENDING,
                Instant.now(clock),
                PageRequest.of(0, relayBatchSize)
        );
        for (UsageCommitOutboxPO readyRecord : readyRecords) {
            resolveSelf().relayById(readyRecord.getId());
        }
    }

    public void relayById(Long outboxId) {
        if (outboxId == null || outboxId <= 0L) {
            throw new BizException("USAGE-400", "outboxId invalid");
        }
        UsageCommitOutboxPO outbox = usageCommitOutboxJpaRepository.findById(outboxId)
                .orElseThrow(() -> new BizException("USAGE-404", "usage commit outbox not found"));
        if (STATUS_DELIVERED.equals(outbox.getStatus())) {
            return;
        }
        try {
            CommitUsageRequestDTO request = readPayload(outbox.getPayloadJson());
            if (EVENT_TYPE_COMMIT_USAGE.equals(outbox.getEventType())) {
                usageAppService.recordCommittedUsageFact(request);
            } else if (EVENT_TYPE_APPEND_USAGE_EVENT.equals(outbox.getEventType())) {
                usageAppService.appendCommittedUsageEvent(request);
            } else {
                throw new BizException("USAGE-500", "unsupported usage commit outbox event type");
            }
            Instant now = Instant.now(clock);
            outbox.setStatus(STATUS_DELIVERED);
            outbox.setDeliveredAt(now);
            outbox.setLastError(null);
            outbox.setUpdatedAt(now);
            usageCommitOutboxJpaRepository.save(outbox);
        } catch (RuntimeException ex) {
            Instant now = Instant.now(clock);
            outbox.setStatus(STATUS_PENDING);
            outbox.setRetryCount(outbox.getRetryCount() + 1);
            outbox.setNextRetryAt(now.plusSeconds(retryDelaySeconds));
            outbox.setLastError(truncateError(ex));
            outbox.setUpdatedAt(now);
            usageCommitOutboxJpaRepository.save(outbox);
            throw ex;
        }
    }

    private UsageCommitOutboxPO saveNewOutbox(CommitUsageRequestDTO request, String idempotencyKey, String eventType) {
        Instant now = Instant.now(clock);
        Instant occurredAt = request.occurredAt() == null ? now : request.occurredAt();
        UsageCommitOutboxPO po = new UsageCommitOutboxPO();
        po.setIdempotencyKey(idempotencyKey);
        po.setEventType(eventType);
        po.setPayloadJson(writePayload(request));
        po.setUserId(request.userId());
        po.setProjectId(request.projectId().trim());
        po.setMetric(request.metric().trim());
        po.setActualAmount(request.actualAmount());
        po.setOccurredAt(occurredAt);
        po.setStatus(STATUS_PENDING);
        po.setRetryCount(0);
        po.setNextRetryAt(now);
        po.setCreatedAt(now);
        po.setUpdatedAt(now);
        return usageCommitOutboxJpaRepository.save(po);
    }

    private void registerAfterCommitRelay(Long outboxId) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    try {
                        resolveSelf().relayById(outboxId);
                    } catch (RuntimeException ignored) {
                        // Keep the outbox row pending for scheduled retry.
                    }
                }
            });
            return;
        }
        try {
            resolveSelf().relayById(outboxId);
        } catch (RuntimeException ignored) {
            // Keep the outbox row pending for scheduled retry.
        }
    }

    private UsageCommitOutboxAppService resolveSelf() {
        if (selfProvider == null) {
            return this;
        }
        return selfProvider.getObject();
    }

    private CommitUsageRequestDTO readPayload(String payloadJson) {
        try {
            Map<String, Object> payload = objectMapper.readValue(payloadJson, MAP_TYPE);
            String occurredAt = (String) payload.get("occurredAt");
            @SuppressWarnings("unchecked")
            Map<String, String> metadata = (Map<String, String>) payload.getOrDefault("metadata", Map.of());
            return new CommitUsageRequestDTO(
                    ((Number) payload.get("userId")).longValue(),
                    (String) payload.get("projectId"),
                    (String) payload.get("metric"),
                    (String) payload.get("reservationId"),
                    (String) payload.get("requestId"),
                    ((Number) payload.get("requestedAmount")).longValue(),
                    ((Number) payload.get("actualAmount")).longValue(),
                    (String) payload.get("idempotencyKey"),
                    (String) payload.get("sourceType"),
                    (String) payload.get("sourceId"),
                    metadata,
                    occurredAt == null || occurredAt.isBlank() ? null : Instant.parse(occurredAt)
            );
        } catch (JsonProcessingException ex) {
            throw new BizException("USAGE-500", "usage commit outbox payload parse failed");
        }
    }

    private String writePayload(CommitUsageRequestDTO request) {
        try {
            Map<String, Object> payload = new HashMap<>();
            payload.put("userId", request.userId());
            payload.put("projectId", request.projectId());
            payload.put("metric", request.metric());
            payload.put("reservationId", request.reservationId());
            payload.put("requestId", request.requestId());
            payload.put("requestedAmount", request.requestedAmount());
            payload.put("actualAmount", request.actualAmount());
            payload.put("idempotencyKey", request.idempotencyKey());
            payload.put("sourceType", request.sourceType());
            payload.put("sourceId", request.sourceId());
            payload.put("metadata", request.metadata() == null ? Map.of() : request.metadata());
            payload.put("occurredAt", request.occurredAt() == null ? "" : request.occurredAt().toString());
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new BizException("USAGE-500", "usage commit outbox payload serialize failed");
        }
    }

    private String truncateError(RuntimeException ex) {
        String message = ex.getMessage();
        if (message == null || message.isBlank()) {
            message = ex.getClass().getSimpleName();
        }
        return message.length() > 4000 ? message.substring(0, 4000) : message;
    }
}
