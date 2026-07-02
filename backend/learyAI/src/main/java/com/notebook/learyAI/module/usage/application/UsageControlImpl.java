// Responsibility: Implement the usage-control SDK by delegating to the usage control application service.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.service.UsageControlAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageControl;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class UsageControlImpl implements UsageControl {
    private final UsageControlAppService usageControlAppService;

    public UsageControlImpl(UsageControlAppService usageControlAppService) {
        this.usageControlAppService = usageControlAppService;
    }

    @Override
    public CurrentUsagePolicy getCurrentPolicy(long userId, String projectId, String metric) {
        return usageControlAppService.getCurrentPolicy(userId, projectId, metric);
    }

    @Override
    public OpenTurnLeaseResult openTurnLease(long userId,
                                             String projectId,
                                             String metric,
                                             String turnId,
                                             String leaseId,
                                             String idempotencyKey,
                                             long leaseTtlSeconds,
                                             Map<String, String> metadata) {
        return usageControlAppService.openTurnLease(userId, projectId, metric, turnId, leaseId, idempotencyKey, leaseTtlSeconds, metadata);
    }

    @Override
    public CommitTurnCallUsageResult commitTurnCallUsage(long userId,
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
        return usageControlAppService.commitTurnCallUsage(
                userId,
                projectId,
                metric,
                leaseId,
                turnId,
                callId,
                actualAmount,
                idempotencyKey,
                sourceType,
                sourceId,
                metadata,
                occurredAt
        );
    }

    @Override
    public CloseTurnLeaseResult closeTurnLease(long userId, String leaseId, String turnId, String idempotencyKey) {
        return usageControlAppService.closeTurnLease(userId, leaseId, turnId, idempotencyKey, "CLOSED");
    }

    @Override
    public CloseTurnLeaseResult abortTurnLease(long userId, String leaseId, String turnId, String idempotencyKey) {
        return usageControlAppService.closeTurnLease(userId, leaseId, turnId, idempotencyKey, "ABORTED");
    }

    @Override
    public TurnLease getTurnLease(String leaseId) {
        return usageControlAppService.getTurnLease(leaseId);
    }

    @Override
    public ReserveSingleCallResult reserveSingleCall(long userId,
                                                     String projectId,
                                                     String metric,
                                                     String reservationId,
                                                     String requestId,
                                                     long requestedAmount,
                                                     long reservationTtlSeconds,
                                                     Map<String, String> metadata) {
        return usageControlAppService.reserveSingleCall(
                userId,
                projectId,
                metric,
                reservationId,
                requestId,
                requestedAmount,
                reservationTtlSeconds,
                metadata
        );
    }

    @Override
    public CommitSingleCallResult commitSingleCall(long userId,
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
        return usageControlAppService.commitSingleCall(
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
                metadata,
                occurredAt
        );
    }

    @Override
    public ReleaseSingleCallResult releaseSingleCall(long userId,
                                                     String projectId,
                                                     String metric,
                                                     String reservationId,
                                                     String requestId) {
        return usageControlAppService.releaseSingleCall(userId, projectId, metric, reservationId, requestId);
    }
}
