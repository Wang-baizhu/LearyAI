// Responsibility: Verify UsageControlGrpcService success paths and extended status mapping.
package com.notebook.learyAI.module.usageservice.interfaces.grpc;

import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.UsagePolicyMode;
import com.notebook.learyAI.module.usageservice.application.facade.UsageFacade;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.proto.UsageServiceProto;
import com.notebook.learyAI.shared.exception.BizException;
import io.grpc.Status;
import io.grpc.stub.StreamObserver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageControlGrpcServiceTest {
    @Mock
    private UsageFacade usageFacade;
    @Mock
    private UsageGrpcMapper usageGrpcMapper;
    @InjectMocks
    private UsageControlGrpcService usageControlGrpcService;

    @Test
    @DisplayName("getCurrentPolicy 成功时应返回映射响应")
    void getCurrentPolicy_success_shouldReturnResponse() {
        CurrentUsagePolicy policy = new CurrentUsagePolicy(
                1L, "p1", "m", 7L, "pro", 100L, 10L, 5L, 85L,
                UsagePolicyMode.MEMBER, Instant.now(), Instant.now(), Instant.now()
        );
        UsageServiceProto.GetCurrentPolicyResponse mapped = UsageServiceProto.GetCurrentPolicyResponse.newBuilder()
                .setCurrentPolicy(UsageServiceProto.CurrentUsagePolicy.newBuilder().setPlanId("pro").build())
                .build();
        when(usageFacade.getCurrentPolicy(1L, "p1", "m")).thenReturn(policy);
        when(usageGrpcMapper.toCurrentPolicyResponse(policy)).thenReturn(mapped);
        CollectingObserver<UsageServiceProto.GetCurrentPolicyResponse> observer = new CollectingObserver<>();

        usageControlGrpcService.getCurrentPolicy(
                UsageServiceProto.GetCurrentPolicyRequest.newBuilder().setUserId(1L).setProjectId("p1").setMetric("m").build(),
                observer
        );

        assertEquals("pro", observer.items.get(0).getCurrentPolicy().getPlanId());
    }

    @Test
    @DisplayName("USAGE-403-TURN 异常应映射为 PERMISSION_DENIED")
    void openTurnLease_usage403Turn_shouldMapPermissionDenied() {
        when(usageFacade.openTurnLease(eq(1L), eq("p1"), eq("m"), eq("turn-1"), eq("lease-1"), eq("idem"), anyLong(), eq(java.util.Map.of())))
                .thenThrow(new BizException("USAGE-403-TURN", "turn denied"));
        CollectingObserver<UsageServiceProto.OpenTurnLeaseResponse> observer = new CollectingObserver<>();

        usageControlGrpcService.openTurnLease(
                UsageServiceProto.OpenTurnLeaseRequest.newBuilder()
                        .setUserId(1L)
                        .setProjectId("p1")
                        .setMetric("m")
                        .setTurnId("turn-1")
                        .setLeaseId("lease-1")
                        .setIdempotencyKey("idem")
                        .build(),
                observer
        );

        assertNotNull(observer.error);
        assertEquals(Status.PERMISSION_DENIED.getCode(), Status.fromThrowable(observer.error).getCode());
    }

    private static class CollectingObserver<T> implements StreamObserver<T> {
        private final java.util.List<T> items = new java.util.ArrayList<>();
        private Throwable error;

        @Override
        public void onNext(T value) {
            items.add(value);
        }

        @Override
        public void onError(Throwable t) {
            error = t;
        }

        @Override
        public void onCompleted() {
        }
    }
}
