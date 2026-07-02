// Responsibility: Expose gRPC APIs for current-policy, turn-lease, and single-call usage control.
package com.notebook.learyAI.module.usageservice.interfaces.grpc;

import com.notebook.learyAI.module.usage.interfaces.sdk.UsageControl;
import com.notebook.learyAI.module.usageservice.application.facade.UsageFacade;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.proto.UsageControlServiceGrpc;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.proto.UsageServiceProto;
import io.grpc.stub.StreamObserver;
import org.springframework.stereotype.Component;

@Component
public class UsageControlGrpcService extends UsageControlServiceGrpc.UsageControlServiceImplBase {
    private final UsageFacade usageFacade;
    private final UsageGrpcMapper usageGrpcMapper;

    public UsageControlGrpcService(UsageFacade usageFacade, UsageGrpcMapper usageGrpcMapper) {
        this.usageFacade = usageFacade;
        this.usageGrpcMapper = usageGrpcMapper;
    }

    @Override
    public void getCurrentPolicy(UsageServiceProto.GetCurrentPolicyRequest request,
                                 StreamObserver<UsageServiceProto.GetCurrentPolicyResponse> responseObserver) {
        try {
            responseObserver.onNext(usageGrpcMapper.toCurrentPolicyResponse(
                    usageFacade.getCurrentPolicy(request.getUserId(), request.getProjectId(), request.getMetric())
            ));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void openTurnLease(UsageServiceProto.OpenTurnLeaseRequest request,
                              StreamObserver<UsageServiceProto.OpenTurnLeaseResponse> responseObserver) {
        try {
            UsageControl.OpenTurnLeaseResult result = usageFacade.openTurnLease(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getTurnId(),
                    request.getLeaseId(),
                    request.getIdempotencyKey(),
                    request.getLeaseTtlSeconds(),
                    request.getMetadataMap()
            );
            responseObserver.onNext(usageGrpcMapper.toOpenTurnLeaseResponse(result.opened(), result.lease(), result.currentPolicy()));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void commitTurnCallUsage(UsageServiceProto.CommitTurnCallUsageRequest request,
                                    StreamObserver<UsageServiceProto.CommitTurnCallUsageResponse> responseObserver) {
        try {
            UsageControl.CommitTurnCallUsageResult result = usageFacade.commitTurnCallUsage(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getLeaseId(),
                    request.getTurnId(),
                    request.getCallId(),
                    request.getActualAmount(),
                    request.getIdempotencyKey(),
                    request.getSourceType(),
                    request.getSourceId(),
                    request.getMetadataMap(),
                    request.getOccurredAt()
            );
            responseObserver.onNext(usageGrpcMapper.toCommitTurnCallUsageResponse(
                    result.applied(),
                    result.lease(),
                    result.currentPolicy(),
                    result.event()
            ));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void closeTurnLease(UsageServiceProto.CloseTurnLeaseRequest request,
                               StreamObserver<UsageServiceProto.CloseTurnLeaseResponse> responseObserver) {
        try {
            UsageControl.CloseTurnLeaseResult result = usageFacade.closeTurnLease(
                    request.getUserId(),
                    request.getLeaseId(),
                    request.getTurnId(),
                    request.getIdempotencyKey()
            );
            responseObserver.onNext(usageGrpcMapper.toCloseTurnLeaseResponse(result.changed(), result.lease()));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void abortTurnLease(UsageServiceProto.AbortTurnLeaseRequest request,
                               StreamObserver<UsageServiceProto.AbortTurnLeaseResponse> responseObserver) {
        try {
            UsageControl.CloseTurnLeaseResult result = usageFacade.abortTurnLease(
                    request.getUserId(),
                    request.getLeaseId(),
                    request.getTurnId(),
                    request.getIdempotencyKey()
            );
            responseObserver.onNext(usageGrpcMapper.toAbortTurnLeaseResponse(result.changed(), result.lease()));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void getTurnLease(UsageServiceProto.GetTurnLeaseRequest request,
                             StreamObserver<UsageServiceProto.GetTurnLeaseResponse> responseObserver) {
        try {
            responseObserver.onNext(usageGrpcMapper.toGetTurnLeaseResponse(usageFacade.getTurnLease(request.getLeaseId())));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void reserveSingleCall(UsageServiceProto.ReserveSingleCallRequest request,
                                  StreamObserver<UsageServiceProto.ReserveSingleCallResponse> responseObserver) {
        try {
            UsageControl.ReserveSingleCallResult result = usageFacade.reserveSingleCall(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getReservationId(),
                    request.getRequestId(),
                    request.getRequestedAmount(),
                    request.getReservationTtlSeconds(),
                    request.getMetadataMap()
            );
            responseObserver.onNext(usageGrpcMapper.toReserveSingleCallResponse(result.delegate(), result.currentPolicy()));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void commitSingleCall(UsageServiceProto.CommitSingleCallRequest request,
                                 StreamObserver<UsageServiceProto.CommitSingleCallResponse> responseObserver) {
        try {
            UsageControl.CommitSingleCallResult result = usageFacade.commitSingleCall(
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
            responseObserver.onNext(usageGrpcMapper.toCommitSingleCallResponse(result.delegate(), result.currentPolicy()));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }

    @Override
    public void releaseSingleCall(UsageServiceProto.ReleaseSingleCallRequest request,
                                  StreamObserver<UsageServiceProto.ReleaseSingleCallResponse> responseObserver) {
        try {
            UsageControl.ReleaseSingleCallResult result = usageFacade.releaseSingleCall(
                    request.getUserId(),
                    request.getProjectId(),
                    request.getMetric(),
                    request.getReservationId(),
                    request.getRequestId()
            );
            responseObserver.onNext(usageGrpcMapper.toReleaseSingleCallResponse(result.delegate(), result.currentPolicy()));
            responseObserver.onCompleted();
        } catch (Throwable ex) {
            responseObserver.onError(UsageGrpcErrors.toGrpcException(ex));
        }
    }
}
