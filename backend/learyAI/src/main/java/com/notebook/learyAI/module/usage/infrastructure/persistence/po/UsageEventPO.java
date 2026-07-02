// Responsibility: Persist usage events as immutable billing facts.
package com.notebook.learyAI.module.usage.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(name = "usage_event",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_usage_event_idempotency_key", columnNames = "idempotency_key")
        },
        indexes = {
                @Index(name = "idx_usage_event_user_metric_occurred_at", columnList = "user_id, metric, occurred_at"),
                @Index(name = "idx_usage_event_user_occurred_at", columnList = "user_id, occurred_at"),
                @Index(name = "idx_usage_event_project_metric_occurred_at", columnList = "project_id, metric, occurred_at")
        })
public class UsageEventPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private long userId;

    @Column(name = "project_id", nullable = false, length = 128)
    private String projectId;

    @Column(name = "metric", nullable = false, length = 128)
    private String metric;

    @Column(name = "delta", nullable = false)
    private long delta;

    @Column(name = "occurred_at", nullable = false)
    private Instant occurredAt;

    @Column(name = "idempotency_key", nullable = false, length = 255)
    private String idempotencyKey;

    @Column(name = "source_type", nullable = false, length = 128)
    private String sourceType;

    @Column(name = "source_id", nullable = false, length = 255)
    private String sourceId;

    @Column(name = "metadata_json", nullable = false, columnDefinition = "TEXT")
    private String metadataJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public long getUserId() {
        return userId;
    }

    public void setUserId(long userId) {
        this.userId = userId;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getMetric() {
        return metric;
    }

    public void setMetric(String metric) {
        this.metric = metric;
    }

    public long getDelta() {
        return delta;
    }

    public void setDelta(long delta) {
        this.delta = delta;
    }

    public Instant getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(Instant occurredAt) {
        this.occurredAt = occurredAt;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public void setIdempotencyKey(String idempotencyKey) {
        this.idempotencyKey = idempotencyKey;
    }

    public String getSourceType() {
        return sourceType;
    }

    public void setSourceType(String sourceType) {
        this.sourceType = sourceType;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public String getMetadataJson() {
        return metadataJson;
    }

    public void setMetadataJson(String metadataJson) {
        this.metadataJson = metadataJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
