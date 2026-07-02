// Responsibility: Manage SSE connections per project+user scope and broadcast events.
package com.notebook.learyAI.module.task.application.push;

import com.notebook.learyAI.module.task.application.push.dto.TaskPushEvent;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.time.Instant;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

@Component
public class TenantPushRegistry {
    private static final long HEARTBEAT_INTERVAL_MS = 5000L;
    private static final int BROADCAST_WORKER_COUNT = 4;

    private final Map<String, Set<SseConnectionMeta>> connections = new ConcurrentHashMap<>();
    private final ExecutorService broadcastExecutor;
    private final ScheduledExecutorService heartbeatExecutor;

    public TenantPushRegistry() {
        this.broadcastExecutor = Executors.newFixedThreadPool(BROADCAST_WORKER_COUNT, runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("kb-task-sse-broadcast");
            thread.setDaemon(true);
            return thread;
        });
        this.heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable);
            thread.setName("kb-task-sse-heartbeat");
            thread.setDaemon(true);
            return thread;
        });
        this.heartbeatExecutor.scheduleAtFixedRate(this::sendHeartbeats,
                HEARTBEAT_INTERVAL_MS, HEARTBEAT_INTERVAL_MS, TimeUnit.MILLISECONDS);
    }

    public static String scopeKey(String projectId, String kbId, Long userId) {
        return projectId + ":" + kbId + ":" + userId;
    }

    public void register(String projectId, String kbId, Long userId, SseEmitter emitter, Long lastRevision) {
        String key = scopeKey(projectId, kbId, userId);
        SseConnectionMeta meta = new SseConnectionMeta(key, lastRevision, Instant.now(), emitter);
        connections.computeIfAbsent(key, ignored -> ConcurrentHashMap.newKeySet()).add(meta);
        emitter.onCompletion(() -> unregister(key, meta));
        emitter.onTimeout(() -> unregister(key, meta));
        emitter.onError(error -> unregister(key, meta));
        sendBootstrapEvent(key, meta);
    }

    public void unregister(String scopeKey, SseConnectionMeta meta) {
        Set<SseConnectionMeta> set = connections.get(scopeKey);
        if (set == null) {
            return;
        }
        set.remove(meta);
        if (set.isEmpty()) {
            connections.remove(scopeKey);
        }
    }

    public void broadcast(String projectId, String kbId, Long userId, TaskPushEvent event) {
        String key = scopeKey(projectId, kbId, userId);
        broadcastExecutor.execute(() -> sendTaskStatusEvent(key, event));
    }

    private void sendHeartbeats() {
        for (Map.Entry<String, Set<SseConnectionMeta>> entry : connections.entrySet()) {
            String scopeKey = entry.getKey();
            for (SseConnectionMeta meta : entry.getValue()) {
                try {
                    meta.getEmitter().send(SseEmitter.event().comment("heartbeat"));
                } catch (IOException ex) {
                    unregister(scopeKey, meta);
                }
            }
        }
    }

    private void sendBootstrapEvent(String scopeKey, SseConnectionMeta meta) {
        try {
            meta.getEmitter().send(SseEmitter.event().comment("connected"));
        } catch (IOException ex) {
            unregister(scopeKey, meta);
            meta.getEmitter().completeWithError(ex);
        }
    }

    private void sendTaskStatusEvent(String scopeKey, TaskPushEvent event) {
        Set<SseConnectionMeta> set = connections.get(scopeKey);
        if (set == null || set.isEmpty()) {
            return;
        }
        for (SseConnectionMeta meta : set) {
            try {
                meta.getEmitter().send(SseEmitter.event()
                        .id(event.getRevision() == null ? null : String.valueOf(event.getRevision()))
                        .name("task-status")
                        .data(event));
            } catch (IOException ex) {
                unregister(scopeKey, meta);
            }
        }
    }

    @PreDestroy
    public void shutdown() {
        broadcastExecutor.shutdownNow();
        heartbeatExecutor.shutdownNow();
    }
}
