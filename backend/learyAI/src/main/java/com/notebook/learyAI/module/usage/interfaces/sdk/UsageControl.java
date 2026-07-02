// Responsibility: Expose current-policy, turn-lease, and single-call quota control to other modules.
package com.notebook.learyAI.module.usage.interfaces.sdk;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;

import java.util.Map;

public interface UsageControl {
    CurrentUsagePolicy getCurrentPolicy(long userId, String projectId, String metric);

    OpenTurnLeaseResult openTurnLease(long userId,
                                      String projectId,
                                      String metric,
                                      String turnId,
                                      String leaseId,
                                      String idempotencyKey,
                                      long leaseTtlSeconds,
                                      Map<String, String> metadata);

    CommitTurnCallUsageResult commitTurnCallUsage(long userId,
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
                                                  String occurredAt);

    CloseTurnLeaseResult closeTurnLease(long userId, String leaseId, String turnId, String idempotencyKey);

    CloseTurnLeaseResult abortTurnLease(long userId, String leaseId, String turnId, String idempotencyKey);

    TurnLease getTurnLease(String leaseId);

    ReserveSingleCallResult reserveSingleCall(long userId,
                                              String projectId,
                                              String metric,
                                              String reservationId,
                                              String requestId,
                                              long requestedAmount,
                                              long reservationTtlSeconds,
                                              Map<String, String> metadata);

    CommitSingleCallResult commitSingleCall(long userId,
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
                                            String occurredAt);

    ReleaseSingleCallResult releaseSingleCall(long userId,
                                              String projectId,
                                              String metric,
                                              String reservationId,
                                              String requestId);

    record OpenTurnLeaseResult(boolean opened, TurnLease lease, CurrentUsagePolicy currentPolicy) {
    }

    record CommitTurnCallUsageResult(boolean applied,
                                     TurnLease lease,
                                     CurrentUsagePolicy currentPolicy,
                                     com.notebook.learyAI.module.usage.domain.model.UsageEvent event) {
    }

    record CloseTurnLeaseResult(boolean changed, TurnLease lease) {
    }

    record ReserveSingleCallResult(ReserveUsageResponseDTO delegate, CurrentUsagePolicy currentPolicy) {
    }

    record CommitSingleCallResult(CommitUsageResponseDTO delegate, CurrentUsagePolicy currentPolicy) {
    }

    record ReleaseSingleCallResult(ReleaseUsageResponseDTO delegate, CurrentUsagePolicy currentPolicy) {
    }
}
