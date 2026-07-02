// Responsibility: Response item payload for paged admin usage event list.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.time.Instant;

public class AdminUsageEventListItemResponse {
    private final long userId;
    private final String projectId;
    private final String metric;
    private final long delta;
    private final String idempotencyKey;
    private final String sourceType;
    private final String sourceId;
    private final Instant occurredAt;
    private final Instant createdAt;

    public AdminUsageEventListItemResponse(long userId,
                                           String projectId,
                                           String metric,
                                           long delta,
                                           String idempotencyKey,
                                           String sourceType,
                                           String sourceId,
                                           Instant occurredAt,
                                           Instant createdAt) {
        this.userId = userId;
        this.projectId = projectId;
        this.metric = metric;
        this.delta = delta;
        this.idempotencyKey = idempotencyKey;
        this.sourceType = sourceType;
        this.sourceId = sourceId;
        this.occurredAt = occurredAt;
        this.createdAt = createdAt;
    }

    public long getUserId() {
        return userId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getMetric() {
        return metric;
    }

    public long getDelta() {
        return delta;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public String getSourceType() {
        return sourceType;
    }

    public String getSourceId() {
        return sourceId;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
