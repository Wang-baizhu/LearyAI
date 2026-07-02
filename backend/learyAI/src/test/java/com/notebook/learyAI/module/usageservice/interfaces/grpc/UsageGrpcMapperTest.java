// Responsibility: Verify UsageGrpcMapper maps new reserve/commit/query payloads.
package com.notebook.learyAI.module.usageservice.interfaces.grpc;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;
import com.notebook.learyAI.module.usage.domain.model.UsagePolicyMode;
import com.notebook.learyAI.module.usage.domain.model.UsageReservation;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.proto.UsageServiceProto;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;

class UsageGrpcMapperTest {
    private final UsageGrpcMapper mapper = new UsageGrpcMapper();

    @Test
    @DisplayName("reserve response 应映射 reservation 与 current cycle")
    void reserve_shouldMapFields() {
        Instant now = Instant.parse("2026-06-19T10:00:00Z");
        CurrentCycleUsage current = new CurrentCycleUsage(1L, "p1", "m", 7L, 3L, 2L, 10L, 5L, now, now.plusSeconds(1), now);
        UsageReservation reservation = new UsageReservation("r1", "q1", 1L, "p1", "m", 2L, "RESERVED", now.plusSeconds(60), now);

        var response = mapper.toReserveResponse(new ReserveUsageResponseDTO(true, true, reservation, current));

        assertEquals("r1", response.getReservation().getReservationId());
        assertEquals(5L, response.getCurrentCycle().getAvailable());
    }

    @Test
    @DisplayName("release 与 rolling response 应映射新字段")
    void releaseAndRolling_shouldMapFields() {
        Instant now = Instant.parse("2026-06-19T10:00:00Z");
        CurrentCycleUsage current = new CurrentCycleUsage(1L, "p1", "m", 7L, 3L, 0L, 10L, 7L, now, now.plusSeconds(1), now);
        var release = mapper.toReleaseResponse(new ReleaseUsageResponseDTO(true, true, current));
        var rolling = mapper.toRollingUsageResponse(new RollingUsage(1L, "p1", "m", UsageWindowType.LAST_24_HOURS, 9L, now.minusSeconds(3600), now, now));

        assertEquals(true, release.getReleased());
        assertEquals("last_24_hours", rolling.getRollingUsage().getWindowType());
    }

    @Test
    @DisplayName("commit response 应映射 current cycle")
    void commit_shouldMapFields() {
        Instant now = Instant.parse("2026-06-19T10:00:00Z");
        CurrentCycleUsage current = new CurrentCycleUsage(1L, "p1", "m", 7L, 8L, 0L, 10L, 2L, now, now.plusSeconds(1), now);
        var response = mapper.toCommitResponse(new CommitUsageResponseDTO(true, true, null, current));

        assertEquals(8L, response.getCurrentCycle().getUsed());
    }

    @Test
    @DisplayName("current policy 与 turn lease response 应映射新结构")
    void currentPolicyAndTurnLease_shouldMapFields() {
        Instant now = Instant.parse("2026-06-19T10:00:00Z");
        CurrentUsagePolicy policy = new CurrentUsagePolicy(1L, "p1", "m", 7L, "pro", 100L, 8L, 2L, 90L, UsagePolicyMode.MEMBER, now, now.plusSeconds(60), now);
        TurnLease lease = new TurnLease("lease-1", 1L, "p1", "m", "turn-1", "pro", "OPEN", now, now, now.plusSeconds(60));

        var policyResponse = mapper.toCurrentPolicyResponse(policy);
        var leaseResponse = mapper.toOpenTurnLeaseResponse(true, lease, policy);

        assertEquals("pro", policyResponse.getCurrentPolicy().getPlanId());
        assertEquals(UsageServiceProto.UsagePolicyMode.USAGE_POLICY_MODE_MEMBER, policyResponse.getCurrentPolicy().getPolicyMode());
        assertEquals("lease-1", leaseResponse.getLease().getLeaseId());
    }
}
