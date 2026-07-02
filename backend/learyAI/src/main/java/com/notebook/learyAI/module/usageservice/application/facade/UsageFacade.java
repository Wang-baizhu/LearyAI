// Responsibility: Bridge usage-service transport layer and usage SDK.
package com.notebook.learyAI.module.usageservice.application.facade;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageControl;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageQuery;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageRecorder;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@Component
public class UsageFacade {
    private final UsageRecorder usageRecorder;
    private final UsageQuery usageQuery;
    private final UsageControl usageControl;

    public UsageFacade(UsageRecorder usageRecorder, UsageQuery usageQuery, UsageControl usageControl) {
        this.usageRecorder = usageRecorder;
        this.usageQuery = usageQuery;
        this.usageControl = usageControl;
    }

    public ReserveUsageResponseDTO reserve(long userId,
                                           String projectId,
                                           String metric,
                                           String reservationId,
                                           String requestId,
                                           long requestedAmount,
                                           long reservationTtlSeconds,
                                           Map<String, String> metadata) {
        return usageRecorder.reserve(new ReserveUsageRequestDTO(
                userId,
                projectId,
                metric,
                reservationId,
                requestId,
                requestedAmount,
                Duration.ofSeconds(reservationTtlSeconds),
                metadata
        ));
    }

    public CommitUsageResponseDTO commit(long userId,
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
        return usageRecorder.commit(new CommitUsageRequestDTO(
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
                occurredAt == null || occurredAt.isBlank() ? null : Instant.parse(occurredAt)
        ));
    }

    public ReleaseUsageResponseDTO release(long userId,
                                           String projectId,
                                           String metric,
                                           String reservationId,
                                           String requestId) {
        return usageRecorder.release(new ReleaseUsageRequestDTO(
                userId,
                projectId,
                metric,
                reservationId,
                requestId
        ));
    }

    public CurrentCycleUsage getCurrentCycleUsage(long userId, String projectId, String metric) {
        return usageQuery.getCurrentCycleUsage(userId, projectId, metric);
    }

    public RollingUsage getRollingUsage(long userId, String projectId, String metric, String windowType) {
        return usageQuery.getRollingUsage(userId, projectId, metric, UsageWindowType.fromWireValue(windowType));
    }

    public CurrentUsagePolicy getCurrentPolicy(long userId, String projectId, String metric) {
        return usageControl.getCurrentPolicy(userId, projectId, metric);
    }

    public UsageControl.OpenTurnLeaseResult openTurnLease(long userId,
                                                          String projectId,
                                                          String metric,
                                                          String turnId,
                                                          String leaseId,
                                                          String idempotencyKey,
                                                          long leaseTtlSeconds,
                                                          Map<String, String> metadata) {
        return usageControl.openTurnLease(userId, projectId, metric, turnId, leaseId, idempotencyKey, leaseTtlSeconds, metadata);
    }

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
        return usageControl.commitTurnCallUsage(
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

    public UsageControl.CloseTurnLeaseResult closeTurnLease(long userId, String leaseId, String turnId, String idempotencyKey) {
        return usageControl.closeTurnLease(userId, leaseId, turnId, idempotencyKey);
    }

    public UsageControl.CloseTurnLeaseResult abortTurnLease(long userId, String leaseId, String turnId, String idempotencyKey) {
        return usageControl.abortTurnLease(userId, leaseId, turnId, idempotencyKey);
    }

    public TurnLease getTurnLease(String leaseId) {
        return usageControl.getTurnLease(leaseId);
    }

    public UsageControl.ReserveSingleCallResult reserveSingleCall(long userId,
                                                                  String projectId,
                                                                  String metric,
                                                                  String reservationId,
                                                                  String requestId,
                                                                  long requestedAmount,
                                                                  long reservationTtlSeconds,
                                                                  Map<String, String> metadata) {
        return usageControl.reserveSingleCall(userId, projectId, metric, reservationId, requestId, requestedAmount, reservationTtlSeconds, metadata);
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
        return usageControl.commitSingleCall(
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

    public UsageControl.ReleaseSingleCallResult releaseSingleCall(long userId,
                                                                  String projectId,
                                                                  String metric,
                                                                  String reservationId,
                                                                  String requestId) {
        return usageControl.releaseSingleCall(userId, projectId, metric, reservationId, requestId);
    }
}
