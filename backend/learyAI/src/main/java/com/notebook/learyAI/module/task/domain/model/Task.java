// Responsibility: Represent a visible pipeline task aggregate.
package com.notebook.learyAI.module.task.domain.model;

import java.time.Instant;

public class Task extends TaskAggregate {
    private final String typeId;

    public Task(Long taskRecordId,
                String publicTaskId,
                String projectId,
                String kbId,
                Long userId,
                String pipelineType,
                TaskStatus status,
                String currentStageKey,
                String contextJson,
                String viewJson,
                String typeId,
                Instant createdAt,
                Instant updatedAt) {
        super(taskRecordId, publicTaskId, projectId, kbId, userId, pipelineType, status,
                currentStageKey, contextJson, viewJson, createdAt, updatedAt);
        this.typeId = typeId;
    }

    public static Task newVisibleTask(String projectId,
                                      String kbId,
                                      Long userId,
                                      String publicTaskId,
                                      String pipelineType,
                                      String typeId,
                                      TaskStatus status,
                                      String pipelineContext,
                                      String currentStage,
                                      String viewData,
                                      Instant createdAt) {
        return new Task(
                null,
                publicTaskId,
                projectId,
                kbId,
                userId,
                pipelineType,
                status,
                currentStage,
                pipelineContext,
                viewData,
                typeId,
                createdAt,
                createdAt
        );
    }

    public Long getTaskRecordId() {
        return getId();
    }

    public String getPublicTaskId() {
        return getTaskId();
    }

    public String getType() {
        return getPipelineType();
    }

    public String getTypeId() {
        return typeId;
    }

    public String getCurrentStage() {
        return getCurrentStageKey();
    }

    public String getPipelineContext() {
        return getContextJson();
    }

    public String getViewData() {
        return getViewJson();
    }

    public Task withState(TaskStatus nextStatus,
                          String nextPipelineContext,
                          String nextCurrentStage,
                          String nextViewData,
                          Instant nextUpdatedAt) {
        return new Task(
                getId(),
                getTaskId(),
                getProjectId(),
                getKbId(),
                getUserId(),
                getPipelineType(),
                nextStatus,
                nextCurrentStage,
                nextPipelineContext,
                nextViewData,
                typeId,
                getCreatedAt(),
                nextUpdatedAt
        );
    }
}
