// Responsibility: Verify tenant-scoped SSE registry register/remove/broadcast behavior.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.push.SseConnectionMeta;
import com.notebook.learyAI.module.task.application.push.TenantPushRegistry;
import com.notebook.learyAI.module.task.application.push.dto.TaskPushEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.lang.reflect.Field;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.function.BooleanSupplier;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.doNothing;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class TenantPushRegistryTest {

    @Test
    @DisplayName("register: 建立连接后应立即发送首帧，避免前端等待 ready 超时")
    void register_shouldSendBootstrapEventImmediately() throws Exception {
        TenantPushRegistry registry = new TenantPushRegistry();
        try {
            SseEmitter emitter = mock(SseEmitter.class);

            registry.register("p1", "kb-1", 1L, emitter, 100L);

            verify(emitter, timeout(1000)).send(any(SseEmitter.SseEventBuilder.class));
            assertEquals(1, connectionCount(registry, TenantPushRegistry.scopeKey("p1", "kb-1", 1L)));
        } finally {
            registry.shutdown();
        }
    }

    @Test
    @DisplayName("register/broadcast: 应按租户注册并发送 task-status 事件")
    void registerAndBroadcast_shouldSendEvent() throws Exception {
        TenantPushRegistry registry = new TenantPushRegistry();
        try {
            SseEmitter emitter = mock(SseEmitter.class);
            registry.register("p1", "kb-1", 1L, emitter, 100L);
            registry.broadcast("p1", "kb-1", 1L, event());

            verify(emitter, timeout(1000).times(2)).send(any(SseEmitter.SseEventBuilder.class));
            assertEquals(1, connectionCount(registry, TenantPushRegistry.scopeKey("p1", "kb-1", 1L)));
        } finally {
            registry.shutdown();
        }
    }

    @Test
    @DisplayName("broadcast 发送异常时应自动移除连接")
    void broadcast_whenSendFailed_shouldUnregisterConnection() throws Exception {
        TenantPushRegistry registry = new TenantPushRegistry();
        try {
            SseEmitter emitter = mock(SseEmitter.class);
            doNothing()
                    .doThrow(new IOException("broken"))
                    .when(emitter)
                    .send(any(SseEmitter.SseEventBuilder.class));
            registry.register("p1", "kb-1", 1L, emitter, null);

            registry.broadcast("p1", "kb-1", 1L, event());

            waitUntil(() -> safeConnectionCount(registry, TenantPushRegistry.scopeKey("p1", "kb-1", 1L)) == 0);
            assertEquals(0, connectionCount(registry, TenantPushRegistry.scopeKey("p1", "kb-1", 1L)));
        } finally {
            registry.shutdown();
        }
    }

    private void waitUntil(BooleanSupplier condition) throws Exception {
        long deadline = System.currentTimeMillis() + 1000L;
        while (System.currentTimeMillis() < deadline) {
            if (condition.getAsBoolean()) {
                return;
            }
            Thread.sleep(20L);
        }
        throw new IllegalStateException("condition not met in time");
    }

    private int safeConnectionCount(TenantPushRegistry registry, String tenantId) {
        try {
            return connectionCount(registry, tenantId);
        } catch (Exception ex) {
            throw new RuntimeException(ex);
        }
    }

    private TaskPushEvent event() {
        return new TaskPushEvent("task-1", "p1", "kb-1", "document_pipeline", "DONE",
                Instant.now(), 1L, "status_change",
                "doc:main", Map.of("info", "ok"));
    }

    @SuppressWarnings("unchecked")
    private int connectionCount(TenantPushRegistry registry, String tenantId) throws Exception {
        Field field = TenantPushRegistry.class.getDeclaredField("connections");
        field.setAccessible(true);
        Map<String, Set<SseConnectionMeta>> map = (Map<String, Set<SseConnectionMeta>>) field.get(registry);
        Set<SseConnectionMeta> set = map.get(tenantId);
        return set == null ? 0 : set.size();
    }
}
