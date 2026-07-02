// Responsibility: Bootstrap and lifecycle-manage the usage gRPC server.
package com.notebook.learyAI.module.usageservice.infrastructure.grpc;

import com.notebook.learyAI.module.usageservice.interfaces.grpc.UsageGrpcService;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.UsageControlGrpcService;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.ServerInterceptors;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.function.IntFunction;

@Component
public class UsageGrpcServer {
    private final UsageGrpcService usageGrpcService;
    private final UsageControlGrpcService usageControlGrpcService;
    private final UsageGrpcAuthInterceptor authInterceptor;
    private final int port;
    private final IntFunction<ServerBuilder<?>> builderFactory;
    private Server server;

    @Autowired
    public UsageGrpcServer(UsageGrpcService usageGrpcService,
                           UsageControlGrpcService usageControlGrpcService,
                           UsageGrpcAuthInterceptor authInterceptor,
                           @Value("${usage.service.grpc.port:9091}") int port) {
        this(usageGrpcService, usageControlGrpcService, authInterceptor, port, ServerBuilder::forPort);
    }

    UsageGrpcServer(UsageGrpcService usageGrpcService,
                    UsageControlGrpcService usageControlGrpcService,
                    UsageGrpcAuthInterceptor authInterceptor,
                    int port,
                    IntFunction<ServerBuilder<?>> builderFactory) {
        this.usageGrpcService = usageGrpcService;
        this.usageControlGrpcService = usageControlGrpcService;
        this.authInterceptor = authInterceptor;
        this.port = port;
        this.builderFactory = builderFactory;
    }

    @PostConstruct
    public void start() throws IOException {
        server = builderFactory.apply(port)
                .addService(ServerInterceptors.intercept(usageGrpcService, authInterceptor))
                .addService(ServerInterceptors.intercept(usageControlGrpcService, authInterceptor))
                .build()
                .start();
    }

    @PreDestroy
    public void stop() {
        if (server != null) {
            server.shutdown();
        }
    }
}
