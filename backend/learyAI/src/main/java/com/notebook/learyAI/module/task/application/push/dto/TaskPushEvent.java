// Responsibility: Represent task status push event payload for SSE.
package com.notebook.learyAI.module.task.application.push.dto;

import java.time.Instant;

public class TaskPushEvent {
    private final String taskId;
    private final String projectId;
    private final String kbId;
    private final String pipelineType;
    private final String status;
    private final Instant updatedAt;
    private final Long revision;
    private final String changeType;
    private final String currentStage;
    private final java.util.Map<String, Object> viewData;

    public TaskPushEvent(String taskId, String projectId, String kbId, String pipelineType, String status,
                         Instant updatedAt, Long revision, String changeType,
                         String currentStage, java.util.Map<String, Object> viewData) {
        this.taskId = taskId;
        this.projectId = projectId;
        this.kbId = kbId;
        this.pipelineType = pipelineType;
        this.status = status;
        this.updatedAt = updatedAt;
        this.revision = revision;
        this.changeType = changeType;
        this.currentStage = currentStage;
        this.viewData = viewData;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getKbId() {
        return kbId;
    }

    public String getPipelineType() {
        return pipelineType;
    }

    public String getStatus() {
        return status;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Long getRevision() {
        return revision;
    }

    public String getChangeType() {
        return changeType;
    }

    public String getCurrentStage() {
        return currentStage;
    }

    public java.util.Map<String, Object> getViewData() {
        return viewData;
    }
}
