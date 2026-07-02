// Responsibility: Represent a stage execution fact under a pipeline task.
package com.notebook.learyAI.module.task.domain.model;

import java.time.Instant;

public class StageExecution {
    private final Long id;
    private final Long taskId;
    private final String stageKey;
    private final String executorType;
    private final String executionType;
    private final TaskStatus status;
    private final String inputJson;
    private final String outputJson;
    private final String errorJson;
    private final Integer attemptNo;
    private final Instant startedAt;
    private final Instant finishedAt;
    private final Instant createdAt;
    private final Instant updatedAt;

    public StageExecution(Long id,
                          Long taskId,
                          String stageKey,
                          String executorType,
                          String executionType,
                          TaskStatus status,
                          String inputJson,
                          String outputJson,
                          String errorJson,
                          Integer attemptNo,
                          Instant startedAt,
                          Instant finishedAt,
                          Instant createdAt,
                          Instant updatedAt) {
        this.id = id;
        this.taskId = taskId;
        this.stageKey = stageKey;
        this.executorType = executorType;
        this.executionType = executionType;
        this.status = status;
        this.inputJson = inputJson;
        this.outputJson = outputJson;
        this.errorJson = errorJson;
        this.attemptNo = attemptNo;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static StageExecution newExecution(Long taskId,
                                              String stageKey,
                                              String executorType,
                                              String executionType,
                                              TaskStatus status,
                                              String inputJson,
                                              Instant createdAt) {
        Instant startedAt = status == TaskStatus.PROCESSING ? createdAt : null;
        Instant finishedAt = isTerminal(status) ? createdAt : null;
        return new StageExecution(
                null,
                taskId,
                stageKey,
                executorType,
                executionType,
                status,
                inputJson,
                null,
                null,
                1,
                startedAt,
                finishedAt,
                createdAt,
                createdAt
        );
    }

    public Long getId() {
        return id;
    }

    public Long getTaskRecordId() {
        return id;
    }

    public Long getTaskId() {
        return taskId;
    }

    public Long getParentTaskRecordId() {
        return taskId;
    }

    public String getStageKey() {
        return stageKey;
    }

    public String getStageRunKey() {
        return stageKey;
    }

    public String getExecutorType() {
        return executorType;
    }

    public String getType() {
        return executorType;
    }

    public String getExecutionType() {
        return executionType;
    }

    public String getTypeId() {
        return executionType;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public String getInputJson() {
        return inputJson;
    }

    public String getStagePayload() {
        return inputJson;
    }

    public String getOutputJson() {
        return outputJson;
    }

    public String getStageResult() {
        return outputJson;
    }

    public String getErrorJson() {
        return errorJson;
    }

    public Integer getAttemptNo() {
        return attemptNo;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getFinishedAt() {
        return finishedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public StageExecution withState(TaskStatus nextStatus,
                                    String nextInputJson,
                                    String nextOutputJson,
                                    String nextErrorJson,
                                    Integer nextAttemptNo,
                                    Instant nextStartedAt,
                                    Instant nextFinishedAt,
                                    Instant nextUpdatedAt) {
        return new StageExecution(
                id,
                taskId,
                stageKey,
                executorType,
                executionType,
                nextStatus,
                nextInputJson,
                nextOutputJson,
                nextErrorJson,
                nextAttemptNo,
                nextStartedAt,
                nextFinishedAt,
                createdAt,
                nextUpdatedAt
        );
    }

    private static boolean isTerminal(TaskStatus status) {
        return status == TaskStatus.DONE || status == TaskStatus.FAILED;
    }
}
