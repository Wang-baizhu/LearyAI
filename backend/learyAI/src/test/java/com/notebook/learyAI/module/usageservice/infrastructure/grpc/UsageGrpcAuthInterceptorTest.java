// Responsibility: Verify UsageGrpcAuthInterceptor AK authentication branches.
package com.notebook.learyAI.module.usageservice.infrastructure.grpc;

import io.grpc.Metadata;
import io.grpc.ServerCall;
import io.grpc.ServerCallHandler;
import io.grpc.Status;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageGrpcAuthInterceptorTest {
    private static final Metadata.Key<String> AK_HEADER =
            Metadata.Key.of("x-usage-ak", Metadata.ASCII_STRING_MARSHALLER);

    @Mock
    private ServerCall<Object, Object> call;
    @Mock
    private ServerCallHandler<Object, Object> next;
    @Mock
    private ServerCall.Listener<Object> listener;

    @Test
    @DisplayName("配置未启用鉴权时应直接放行")
    void interceptCall_emptyExpectedAk_shouldPass() {
        UsageGrpcAuthInterceptor interceptor = new UsageGrpcAuthInterceptor(" ");
        when(next.startCall(any(), any())).thenReturn(listener);

        ServerCall.Listener<Object> result = interceptor.interceptCall(call, new Metadata(), next);

        assertNotNull(result);
        verify(next).startCall(any(), any());
    }

    @Test
    @DisplayName("缺失或错误 AK 时应返回 UNAUTHENTICATED")
    void interceptCall_invalidAk_shouldCloseUnauthenticated() {
        UsageGrpcAuthInterceptor interceptor = new UsageGrpcAuthInterceptor("expected-ak");

        ServerCall.Listener<Object> result = interceptor.interceptCall(call, new Metadata(), next);

        assertNotNull(result);
        ArgumentCaptor<Status> statusCaptor = ArgumentCaptor.forClass(Status.class);
        verify(call).close(statusCaptor.capture(), any());
        assertEquals(Status.Code.UNAUTHENTICATED, statusCaptor.getValue().getCode());
        assertEquals("ak invalid", statusCaptor.getValue().getDescription());
    }

    @Test
    @DisplayName("AK 匹配时应放行")
    void interceptCall_validAk_shouldPass() {
        UsageGrpcAuthInterceptor interceptor = new UsageGrpcAuthInterceptor("expected-ak");
        Metadata headers = new Metadata();
        headers.put(AK_HEADER, " expected-ak ");
        when(next.startCall(call, headers)).thenReturn(listener);

        ServerCall.Listener<Object> result = interceptor.interceptCall(call, headers, next);

        assertNotNull(result);
        verify(next).startCall(call, headers);
    }
}
