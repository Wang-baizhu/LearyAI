// Responsibility: Represent a visible pipeline task aggregate.
package com.notebook.learyAI.module.task.domain.model;

import java.time.Instant;

public class TaskAggregate {
    private final Long id;
    private final String taskId;
    private final String projectId;
    private final String kbId;
    private final Long userId;
    private final String pipelineType;
    private final TaskStatus status;
    private final String currentStageKey;
    private final String contextJson;
    private final String viewJson;
    private final Instant createdAt;
    private final Instant updatedAt;

    public TaskAggregate(Long id,
                         String taskId,
                         String projectId,
                         String kbId,
                         Long userId,
                         String pipelineType,
                         TaskStatus status,
                         String currentStageKey,
                         String contextJson,
                         String viewJson,
                         Instant createdAt,
                         Instant updatedAt) {
        this.id = id;
        this.taskId = taskId;
        this.projectId = projectId;
        this.kbId = kbId;
        this.userId = userId;
        this.pipelineType = pipelineType;
        this.status = status;
        this.currentStageKey = currentStageKey;
        this.contextJson = contextJson;
        this.viewJson = viewJson;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static TaskAggregate newPipelineTask(String projectId,
                                                String kbId,
                                                Long userId,
                                                String taskId,
                                                String pipelineType,
                                                TaskStatus status,
                                                String currentStageKey,
                                                String contextJson,
                                                String viewJson,
                                                Instant createdAt) {
        return new TaskAggregate(
                null,
                taskId,
                projectId,
                kbId,
                userId,
                pipelineType,
                status,
                currentStageKey,
                contextJson,
                viewJson,
                createdAt,
                createdAt
        );
    }

    public Long getId() {
        return id;
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

    public Long getUserId() {
        return userId;
    }

    public String getPipelineType() {
        return pipelineType;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public String getCurrentStageKey() {
        return currentStageKey;
    }

    public String getContextJson() {
        return contextJson;
    }

    public String getViewJson() {
        return viewJson;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public TaskAggregate withState(TaskStatus nextStatus,
                                   String nextContextJson,
                                   String nextCurrentStageKey,
                                   String nextViewJson,
                                   Instant nextUpdatedAt) {
        return new TaskAggregate(
                id,
                taskId,
                projectId,
                kbId,
                userId,
                pipelineType,
                nextStatus,
                nextCurrentStageKey,
                nextContextJson,
                nextViewJson,
                createdAt,
                nextUpdatedAt
        );
    }
}
