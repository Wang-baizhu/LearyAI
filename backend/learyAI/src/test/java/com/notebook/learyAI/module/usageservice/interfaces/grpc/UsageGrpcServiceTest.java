// Responsibility: Verify UsageGrpcService success paths and BizException-to-gRPC status mapping.
package com.notebook.learyAI.module.usageservice.interfaces.grpc;

import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
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
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageGrpcServiceTest {
    @Mock
    private UsageFacade usageFacade;
    @Mock
    private UsageGrpcMapper usageGrpcMapper;
    @InjectMocks
    private UsageGrpcService usageGrpcService;

    @Test
    @DisplayName("reserveUsage 成功时应返回映射响应并完成流")
    void reserveUsage_success_shouldReturnResponse() {
        UsageServiceProto.ReserveUsageRequest request = UsageServiceProto.ReserveUsageRequest.newBuilder()
                .setUserId(1L).setProjectId("p1").setMetric("m").setReservationId("r1").setRequestId("q1").setRequestedAmount(3L)
                .putAllMetadata(Map.of("k", "v")).build();
        ReserveUsageResponseDTO dto = new ReserveUsageResponseDTO(true, true, null, null);
        UsageServiceProto.ReserveUsageResponse mapped = UsageServiceProto.ReserveUsageResponse.newBuilder().setSuccess(true).setReserved(true).build();
        when(usageFacade.reserve(1L, "p1", "m", "r1", "q1", 3L, 0L, Map.of("k", "v"))).thenReturn(dto);
        when(usageGrpcMapper.toReserveResponse(dto)).thenReturn(mapped);
        CollectingObserver<UsageServiceProto.ReserveUsageResponse> observer = new CollectingObserver<>();

        usageGrpcService.reserveUsage(request, observer);

        assertEquals(1, observer.items.size());
        assertTrue(observer.completed);
    }

    @Test
    @DisplayName("getCurrentCycleUsage 成功时应返回映射响应")
    void getCurrentCycleUsage_success_shouldReturnResponse() {
        UsageServiceProto.GetCurrentCycleUsageRequest request = UsageServiceProto.GetCurrentCycleUsageRequest.newBuilder()
                .setUserId(1L).setProjectId("p1").setMetric("m").build();
        CurrentCycleUsage usage = new CurrentCycleUsage(1L, "p1", "m", 1L, 3L, 1L, 10L, 6L, Instant.now(), Instant.now(), Instant.now());
        UsageServiceProto.GetCurrentCycleUsageResponse mapped = UsageServiceProto.GetCurrentCycleUsageResponse.newBuilder()
                .setCurrentCycle(UsageServiceProto.CurrentCycleUsage.newBuilder().setAvailable(6L).build()).build();
        when(usageFacade.getCurrentCycleUsage(1L, "p1", "m")).thenReturn(usage);
        when(usageGrpcMapper.toCurrentCycleResponse(usage)).thenReturn(mapped);
        CollectingObserver<UsageServiceProto.GetCurrentCycleUsageResponse> observer = new CollectingObserver<>();

        usageGrpcService.getCurrentCycleUsage(request, observer);

        assertEquals(6L, observer.items.get(0).getCurrentCycle().getAvailable());
    }

    @Test
    @DisplayName("USAGE-400 异常应映射为 INVALID_ARGUMENT")
    void reserveUsage_usage400_shouldMapInvalidArgument() {
        UsageServiceProto.ReserveUsageRequest request = UsageServiceProto.ReserveUsageRequest.newBuilder()
                .setUserId(1L).setProjectId("p1").setMetric("m").setReservationId("r1").setRequestId("q1").setRequestedAmount(1L).build();
        when(usageFacade.reserve(1L, "p1", "m", "r1", "q1", 1L, 0L, Map.of()))
                .thenThrow(new BizException("USAGE-400", "bad request"));
        CollectingObserver<UsageServiceProto.ReserveUsageResponse> observer = new CollectingObserver<>();

        usageGrpcService.reserveUsage(request, observer);

        assertNotNull(observer.error);
        assertEquals(Status.INVALID_ARGUMENT.getCode(), Status.fromThrowable(observer.error).getCode());
    }

    private static class CollectingObserver<T> implements StreamObserver<T> {
        private final java.util.List<T> items = new java.util.ArrayList<>();
        private Throwable error;
        private boolean completed;

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
            completed = true;
        }
    }
}
