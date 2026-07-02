// Responsibility: JPA entity mapping for consumed task.status idempotency records.
package com.notebook.learyAI.module.task.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "task_status_event",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_task_status_event_event_id", columnNames = {"event_id"})
        },
        indexes = {
                @Index(name = "idx_task_status_event_task", columnList = "project_id,task_record_id"),
                @Index(name = "idx_task_status_event_processed", columnList = "processed_at")
        })
public class TaskStatusEventPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false, length = 128)
    private String eventId;

    @Column(name = "project_id", columnDefinition = "uuid")
    private UUID projectId;

    @Column(name = "task_record_id", nullable = false)
    private Long taskRecordId;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEventId() {
        return eventId;
    }

    public void setEventId(String eventId) {
        this.eventId = eventId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public Long getTaskRecordId() {
        return taskRecordId;
    }

    public void setTaskRecordId(Long taskRecordId) {
        this.taskRecordId = taskRecordId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Instant getProcessedAt() {
        return processedAt;
    }

    public void setProcessedAt(Instant processedAt) {
        this.processedAt = processedAt;
    }
}
