// Responsibility: Verify UsageGrpcServer lifecycle (start/stop) and server builder wiring.
package com.notebook.learyAI.module.usageservice.infrastructure.grpc;

import com.notebook.learyAI.module.usageservice.application.facade.UsageFacade;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.UsageControlGrpcService;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.UsageGrpcService;
import com.notebook.learyAI.module.usageservice.interfaces.grpc.UsageGrpcMapper;
import io.grpc.Server;
import io.grpc.ServerBuilder;
import io.grpc.ServerServiceDefinition;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import java.util.function.IntFunction;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class UsageGrpcServerTest {
    @Test
    @DisplayName("start/stop: 应启动 gRPC server 并在 stop 时关闭")
    void startAndStop_shouldManageServerLifecycle() throws Exception {
        UsageGrpcService grpcService = new UsageGrpcService(mock(UsageFacade.class), new UsageGrpcMapper());
        UsageControlGrpcService usageControlGrpcService = mock(UsageControlGrpcService.class);
        UsageGrpcAuthInterceptor authInterceptor = mock(UsageGrpcAuthInterceptor.class);
        @SuppressWarnings("unchecked")
        ServerBuilder<?> serverBuilder = mock(ServerBuilder.class);
        Server server = mock(Server.class);
        doReturn(serverBuilder).when(serverBuilder).addService(any(ServerServiceDefinition.class));
        when(serverBuilder.build()).thenReturn(server);
        when(server.start()).thenReturn(server);
        @SuppressWarnings("unchecked")
        IntFunction<ServerBuilder<?>> builderFactory = mock(IntFunction.class);
        doReturn(serverBuilder).when(builderFactory).apply(9091);

        UsageGrpcServer usageGrpcServer = new UsageGrpcServer(grpcService, usageControlGrpcService, authInterceptor, 9091, builderFactory);

        usageGrpcServer.start();
        usageGrpcServer.stop();

        verify(server).start();
        verify(server).shutdown();
    }

    @Test
    @DisplayName("stop: server 未启动时不应抛异常")
    void stop_withoutStart_shouldNoop() {
        UsageGrpcServer usageGrpcServer = new UsageGrpcServer(
                new UsageGrpcService(mock(UsageFacade.class), new UsageGrpcMapper()),
                mock(UsageControlGrpcService.class),
                mock(UsageGrpcAuthInterceptor.class),
                9091
        );

        usageGrpcServer.stop();
    }
}
