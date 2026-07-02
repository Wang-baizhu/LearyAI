// Responsibility: JPA entity mapping for task table.
package com.notebook.learyAI.module.task.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "task",
        indexes = {
                @Index(name = "idx_task_public_task_id", columnList = "public_task_id"),
                @Index(name = "idx_task_project_id", columnList = "project_id"),
                @Index(name = "idx_task_project_kb_created", columnList = "project_id,kb_id,created_at"),
                @Index(name = "idx_task_pipeline_type_status", columnList = "pipeline_type,status"),
                @Index(name = "idx_task_status", columnList = "status"),
                @Index(name = "idx_task_created_at", columnList = "created_at")
        })
public class TaskPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_task_id", length = 36, unique = true)
    private String publicTaskId;

    @Column(name = "project_id", columnDefinition = "uuid")
    private java.util.UUID projectId;

    @Column(name = "kb_id", length = 64)
    private String kbId;

    @Column(name = "pipeline_type", length = 64)
    private String pipelineType;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(name = "context_json", columnDefinition = "text")
    private String contextJson;

    @Column(name = "current_stage_key", length = 64)
    private String currentStageKey;

    @Column(name = "view_json", columnDefinition = "text")
    private String viewJson;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getPublicTaskId() {
        return publicTaskId;
    }

    public void setPublicTaskId(String publicTaskId) {
        this.publicTaskId = publicTaskId;
    }

    public java.util.UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(java.util.UUID projectId) {
        this.projectId = projectId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public String getPipelineType() {
        return pipelineType;
    }

    public void setPipelineType(String pipelineType) {
        this.pipelineType = pipelineType;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getContextJson() {
        return contextJson;
    }

    public void setContextJson(String contextJson) {
        this.contextJson = contextJson;
    }

    public String getCurrentStageKey() {
        return currentStageKey;
    }

    public void setCurrentStageKey(String currentStageKey) {
        this.currentStageKey = currentStageKey;
    }

    public String getViewJson() {
        return viewJson;
    }

    public void setViewJson(String viewJson) {
        this.viewJson = viewJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
