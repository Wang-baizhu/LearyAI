// Responsibility: Convert usage facade models to gRPC response messages.
package com.notebook.learyAI.module.usageservice.interfaces.grpc;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;
import com.notebook.learyAI.module.usage.domain.model.UsageEvent;
import com.notebook.learyAI.module.usage.domain.model.UsagePolicyMode;
import com.notebook.learyAI.module.usage.domain.model.UsageReservation;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.proto.UsageServiceProto;
import org.springframework.stereotype.Component;

@Component
public class UsageGrpcMapper {
    public UsageServiceProto.ReserveUsageResponse toReserveResponse(ReserveUsageResponseDTO dto) {
        return UsageServiceProto.ReserveUsageResponse.newBuilder()
                .setSuccess(dto.success())
                .setReserved(dto.reserved())
                .setReservation(toReservation(dto.reservation()))
                .setCurrentCycle(toCurrentCycle(dto.currentCycle()))
                .build();
    }

    public UsageServiceProto.CommitUsageResponse toCommitResponse(CommitUsageResponseDTO dto) {
        UsageServiceProto.CommitUsageResponse.Builder builder = UsageServiceProto.CommitUsageResponse.newBuilder()
                .setSuccess(dto.success())
                .setApplied(dto.applied())
                .setCurrentCycle(toCurrentCycle(dto.currentCycle()));
        if (dto.event() != null) {
            builder.setEvent(toEvent(dto.event()));
        }
        return builder.build();
    }

    public UsageServiceProto.ReleaseUsageResponse toReleaseResponse(ReleaseUsageResponseDTO dto) {
        return UsageServiceProto.ReleaseUsageResponse.newBuilder()
                .setSuccess(dto.success())
                .setReleased(dto.released())
                .setCurrentCycle(toCurrentCycle(dto.currentCycle()))
                .build();
    }

    public UsageServiceProto.GetCurrentCycleUsageResponse toCurrentCycleResponse(CurrentCycleUsage usage) {
        return UsageServiceProto.GetCurrentCycleUsageResponse.newBuilder()
                .setCurrentCycle(toCurrentCycle(usage))
                .build();
    }

    public UsageServiceProto.GetRollingUsageResponse toRollingUsageResponse(RollingUsage usage) {
        return UsageServiceProto.GetRollingUsageResponse.newBuilder()
                .setRollingUsage(UsageServiceProto.RollingUsage.newBuilder()
                        .setUserId(usage.userId())
                        .setProjectId(usage.projectId())
                        .setMetric(usage.metric())
                        .setWindowType(usage.windowType().wireValue())
                        .setUsed(usage.used())
                        .setWindowStart(usage.windowStart().toString())
                        .setWindowEnd(usage.windowEnd().toString())
                        .setUpdatedAt(usage.updatedAt().toString())
                        .build())
                .build();
    }

    public UsageServiceProto.GetCurrentPolicyResponse toCurrentPolicyResponse(CurrentUsagePolicy policy) {
        return UsageServiceProto.GetCurrentPolicyResponse.newBuilder()
                .setCurrentPolicy(toCurrentPolicy(policy))
                .build();
    }

    public UsageServiceProto.OpenTurnLeaseResponse toOpenTurnLeaseResponse(boolean opened, TurnLease lease, CurrentUsagePolicy policy) {
        return UsageServiceProto.OpenTurnLeaseResponse.newBuilder()
                .setSuccess(true)
                .setOpened(opened)
                .setLease(toTurnLease(lease))
                .setCurrentPolicy(toCurrentPolicy(policy))
                .build();
    }

    public UsageServiceProto.CommitTurnCallUsageResponse toCommitTurnCallUsageResponse(boolean applied,
                                                                                       TurnLease lease,
                                                                                       CurrentUsagePolicy policy,
                                                                                       UsageEvent event) {
        UsageServiceProto.CommitTurnCallUsageResponse.Builder builder = UsageServiceProto.CommitTurnCallUsageResponse.newBuilder()
                .setSuccess(true)
                .setApplied(applied)
                .setLease(toTurnLease(lease))
                .setCurrentPolicy(toCurrentPolicy(policy));
        if (event != null) {
            builder.setEvent(toEvent(event));
        }
        return builder.build();
    }

    public UsageServiceProto.CloseTurnLeaseResponse toCloseTurnLeaseResponse(boolean closed, TurnLease lease) {
        return UsageServiceProto.CloseTurnLeaseResponse.newBuilder()
                .setSuccess(true)
                .setClosed(closed)
                .setLease(toTurnLease(lease))
                .build();
    }

    public UsageServiceProto.AbortTurnLeaseResponse toAbortTurnLeaseResponse(boolean aborted, TurnLease lease) {
        return UsageServiceProto.AbortTurnLeaseResponse.newBuilder()
                .setSuccess(true)
                .setAborted(aborted)
                .setLease(toTurnLease(lease))
                .build();
    }

    public UsageServiceProto.GetTurnLeaseResponse toGetTurnLeaseResponse(TurnLease lease) {
        return UsageServiceProto.GetTurnLeaseResponse.newBuilder()
                .setLease(toTurnLease(lease))
                .build();
    }

    public UsageServiceProto.ReserveSingleCallResponse toReserveSingleCallResponse(ReserveUsageResponseDTO dto, CurrentUsagePolicy policy) {
        return UsageServiceProto.ReserveSingleCallResponse.newBuilder()
                .setSuccess(dto.success())
                .setReserved(dto.reserved())
                .setReservation(toReservation(dto.reservation()))
                .setCurrentPolicy(toCurrentPolicy(policy))
                .build();
    }

    public UsageServiceProto.CommitSingleCallResponse toCommitSingleCallResponse(CommitUsageResponseDTO dto, CurrentUsagePolicy policy) {
        UsageServiceProto.CommitSingleCallResponse.Builder builder = UsageServiceProto.CommitSingleCallResponse.newBuilder()
                .setSuccess(dto.success())
                .setApplied(dto.applied())
                .setCurrentPolicy(toCurrentPolicy(policy));
        if (dto.event() != null) {
            builder.setEvent(toEvent(dto.event()));
        }
        return builder.build();
    }

    public UsageServiceProto.ReleaseSingleCallResponse toReleaseSingleCallResponse(ReleaseUsageResponseDTO dto, CurrentUsagePolicy policy) {
        return UsageServiceProto.ReleaseSingleCallResponse.newBuilder()
                .setSuccess(dto.success())
                .setReleased(dto.released())
                .setCurrentPolicy(toCurrentPolicy(policy))
                .build();
    }

    private UsageServiceProto.UsageReservation toReservation(UsageReservation reservation) {
        if (reservation == null) {
            return UsageServiceProto.UsageReservation.getDefaultInstance();
        }
        return UsageServiceProto.UsageReservation.newBuilder()
                .setReservationId(reservation.reservationId())
                .setRequestId(reservation.requestId())
                .setUserId(reservation.userId())
                .setProjectId(reservation.projectId())
                .setMetric(reservation.metric())
                .setReservedAmount(reservation.reservedAmount())
                .setStatus(reservation.status())
                .setExpiresAt(reservation.expiresAt().toString())
                .setUpdatedAt(reservation.updatedAt().toString())
                .build();
    }

    private UsageServiceProto.CurrentCycleUsage toCurrentCycle(CurrentCycleUsage usage) {
        return UsageServiceProto.CurrentCycleUsage.newBuilder()
                .setUserId(usage.userId())
                .setProjectId(usage.projectId())
                .setMetric(usage.metric())
                .setCycleId(usage.cycleId())
                .setUsed(usage.used())
                .setReserved(usage.reserved())
                .setQuota(usage.quota())
                .setAvailable(usage.available())
                .setValidFrom(usage.validFrom().toString())
                .setValidTo(usage.validTo().toString())
                .setUpdatedAt(usage.updatedAt().toString())
                .build();
    }

    private UsageServiceProto.CurrentUsagePolicy toCurrentPolicy(CurrentUsagePolicy policy) {
        return UsageServiceProto.CurrentUsagePolicy.newBuilder()
                .setUserId(policy.userId())
                .setProjectId(policy.projectId())
                .setMetric(policy.metric())
                .setCycleId(policy.cycleId())
                .setPlanId(policy.planId())
                .setQuota(policy.quota())
                .setUsed(policy.used())
                .setReserved(policy.reserved())
                .setAvailable(policy.available())
                .setPolicyMode(toPolicyMode(policy.policyMode()))
                .setValidFrom(policy.validFrom().toString())
                .setValidTo(policy.validTo().toString())
                .setUpdatedAt(policy.updatedAt().toString())
                .build();
    }

    private UsageServiceProto.UsagePolicyMode toPolicyMode(UsagePolicyMode mode) {
        return mode == UsagePolicyMode.MEMBER
                ? UsageServiceProto.UsagePolicyMode.USAGE_POLICY_MODE_MEMBER
                : UsageServiceProto.UsagePolicyMode.USAGE_POLICY_MODE_NON_MEMBER;
    }

    private UsageServiceProto.TurnLease toTurnLease(TurnLease lease) {
        if (lease == null) {
            return UsageServiceProto.TurnLease.getDefaultInstance();
        }
        return UsageServiceProto.TurnLease.newBuilder()
                .setLeaseId(lease.leaseId())
                .setUserId(lease.userId())
                .setProjectId(lease.projectId())
                .setMetric(lease.metric())
                .setTurnId(lease.turnId())
                .setPlanId(lease.planId())
                .setStatus(lease.status())
                .setCreatedAt(lease.createdAt().toString())
                .setUpdatedAt(lease.updatedAt().toString())
                .setExpiresAt(lease.expiresAt().toString())
                .build();
    }

    private UsageServiceProto.UsageEvent toEvent(UsageEvent event) {
        UsageServiceProto.UsageEvent.Builder builder = UsageServiceProto.UsageEvent.newBuilder()
                .setId(event.id() == null ? 0L : event.id())
                .setUserId(event.userId())
                .setProjectId(event.projectId())
                .setMetric(event.metric())
                .setDelta(event.delta())
                .setOccurredAt(event.occurredAt().toString())
                .setIdempotencyKey(event.idempotencyKey())
                .setSourceType(event.sourceType())
                .setSourceId(event.sourceId())
                .setCreatedAt(event.createdAt().toString());
        if (event.metadata() != null) {
            builder.putAllMetadata(event.metadata());
        }
        return builder.build();
    }
}
