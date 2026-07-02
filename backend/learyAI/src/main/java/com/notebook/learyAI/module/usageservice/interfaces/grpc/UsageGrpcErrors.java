// Responsibility: Map usage-domain exceptions to gRPC statuses shared by usageservice transports.
package com.notebook.learyAI.module.usageservice.interfaces.grpc;

import com.notebook.learyAI.shared.exception.BizException;
import io.grpc.Status;
import io.grpc.StatusRuntimeException;

final class UsageGrpcErrors {
    private UsageGrpcErrors() {
    }

    static StatusRuntimeException toGrpcException(Throwable ex) {
        if (ex instanceof BizException bizEx) {
            String code = bizEx.getCode();
            if ("USAGE-400".equals(code)) {
                return Status.INVALID_ARGUMENT.withDescription(bizEx.getMessage()).asRuntimeException();
            }
            if ("USAGE-401".equals(code)) {
                return Status.UNAUTHENTICATED.withDescription(bizEx.getMessage()).asRuntimeException();
            }
            if ("USAGE-403".equals(code) || "USAGE-403-TURN".equals(code) || "USAGE-403-CALL".equals(code)) {
                return Status.PERMISSION_DENIED.withDescription(bizEx.getMessage()).asRuntimeException();
            }
            if ("USAGE-409".equals(code) || "USAGE-409-LEASE".equals(code) || "USAGE-409-CALL".equals(code)) {
                return Status.ALREADY_EXISTS.withDescription(bizEx.getMessage()).asRuntimeException();
            }
            if ("USAGE-404".equals(code)) {
                return Status.NOT_FOUND.withDescription(bizEx.getMessage()).asRuntimeException();
            }
            return Status.INTERNAL.withDescription(bizEx.getMessage()).asRuntimeException();
        }
        return Status.INTERNAL.withDescription("internal error").asRuntimeException();
    }
}
