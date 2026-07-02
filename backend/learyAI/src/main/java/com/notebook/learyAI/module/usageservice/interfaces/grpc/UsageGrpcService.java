// Responsibility: Expose gRPC APIs for usage reservation, settlement, and query.
package com.notebook.learyAI.module.usageservice.interfaces.grpc;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usageservice.application.facade.UsageFacade;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.proto.UsageServiceProto;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.proto.UsageServiceGrpc;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Component;

@Component
public class UsageGrpcService extends UsageServiceGrpc.UsageServiceImplBase {
    private final UsageFacade usageFacade;
    private final UsageGrpcMapper usageGrpcMapper;

    public UsageGrpcService(UsageFacade usageFacade, UsageGrpcMapper usageGrpcMapper) {
        this.usageFacade = usageFacade;
        this.usageGrpcMapper = usageGrpcMapper;
    }

    @Override
    public void reserveUsage(UsageServiceProto.ReserveUsageRequest request,
                             StreamObserver<UsageServiceProto.ReserveUsageResponse> responseObserver) {
        try {
            ReserveUsageResponseDTO result = usageFacade.reserve(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getReservationId(),
                    request.getRequestId(),
                    request.getRequestedAmount(),
                    request.getReservationTtlSeconds(),
                    request.getMetadataMap()
            );
            responseObserver.onNext(usageGrpcMapper.toReserveResponse(result));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void commitUsage(UsageServiceProto.CommitUsageRequest request,
                            StreamObserver<UsageServiceProto.CommitUsageResponse> responseObserver) {
        try {
            CommitUsageResponseDTO result = usageFacade.commit(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getReservationId(),
                    request.getRequestId(),
                    request.getRequestedAmount(),
                    request.getActualAmount(),
                    request.getIdempotencyKey(),
                    request.getSourceType(),
                    request.getSourceId(),
                    request.getMetadataMap(),
                    request.getOccurredAt()
            );
            responseObserver.onNext(usageGrpcMapper.toCommitResponse(result));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void releaseUsage(UsageServiceProto.ReleaseUsageRequest request,
                             StreamObserver<UsageServiceProto.ReleaseUsageResponse> responseObserver) {
        try {
            ReleaseUsageResponseDTO result = usageFacade.release(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getReservationId(),
                    request.getRequestId()
            );
            responseObserver.onNext(usageGrpcMapper.toReleaseResponse(result));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void getCurrentCycleUsage(UsageServiceProto.GetCurrentCycleUsageRequest request,
                                     StreamObserver<UsageServiceProto.GetCurrentCycleUsageResponse> responseObserver) {
        try {
            CurrentCycleUsage usage = usageFacade.getCurrentCycleUsage(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric()
            );
            responseObserver.onNext(usageGrpcMapper.toCurrentCycleResponse(usage));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void getRollingUsage(UsageServiceProto.GetRollingUsageRequest request,
                                StreamObserver<UsageServiceProto.GetRollingUsageResponse> responseObserver) {
        try {
            RollingUsage usage = usageFacade.getRollingUsage(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getWindowType()
            );
            responseObserver.onNext(usageGrpcMapper.toRollingUsageResponse(usage));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }
}
