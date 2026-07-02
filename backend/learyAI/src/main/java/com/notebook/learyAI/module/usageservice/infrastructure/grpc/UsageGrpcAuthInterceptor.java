// Responsibility: Enforce optional service-to-service authentication for usage gRPC APIs.
package com.notebook.learyAI.module.usageservice.infrastructure.grpc;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.ServerInterceptor;
import io.grpc.Status;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class UsageGrpcAuthInterceptor implements ServerInterceptor {
    private static final Metadata.Key<String> AK_HEADER = Metadata.Key.of("x-usage-ak", Metadata.ASCII_STRING_MARSHALLER);

    private final String expectedAk;

    public UsageGrpcAuthInterceptor(@Value("${usage.service.ak:}") String expectedAk) {
        this.expectedAk = expectedAk == null ? "" : expectedAk.trim();
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(ServerCall<ReqT, RespT> call,
                                                                  Metadata headers,
                                                                  ServerCallHandler<ReqT, RespT> next) {
        if (expectedAk.isEmpty()) {
            return next.startCall(call, headers);
        }
        String incomingAk = headers.get(AK_HEADER);
        if (incomingAk == null || !expectedAk.equals(incomingAk.trim())) {
            call.close(Status.UNAUTHENTICATED.withDescription("ak invalid"), new Metadata());
            return new ServerCall.Listener<>() {
            };
        }
        return next.startCall(call, headers);
    }
}
