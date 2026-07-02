// Responsibility: Hold SSE connection metadata for a scoped key.
package com.notebook.learyAI.module.task.application.push;

import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.time.Instant;

public class SseConnectionMeta {
    private final String scopeKey;
    private final Long lastRevision;
    private final Instant createdAt;
    private final SseEmitter emitter;

    public SseConnectionMeta(String scopeKey, Long lastRevision, Instant createdAt, SseEmitter emitter) {
        this.scopeKey = scopeKey;
        this.lastRevision = lastRevision;
        this.createdAt = createdAt;
        this.emitter = emitter;
    }

    public String getScopeKey() {
        return scopeKey;
    }

    public Long getLastRevision() {
        return lastRevision;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public SseEmitter getEmitter() {
        return emitter;
    }
}
