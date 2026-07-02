// Responsibility: Represent a persisted DLQ incident and its compensation state.
package com.notebook.learyAI.module.task.domain.model;

import java.time.Instant;

public class TaskDlqIncident {
    public static final String STATUS_OPEN = "OPEN";
    public static final String STATUS_COMPENSATED = "COMPENSATED";
    public static final String STATUS_RESOLVED = "RESOLVED";
    public static final String STATUS_IGNORED = "IGNORED";

    private final Long id;
    private final String messageId;
    private final String sourceQueue;
    private final String sourceRoutingKey;
    private final String dlqType;
    private final Long taskRecordId;
    private final Long parentTaskRecordId;
    private final String projectId;
    private final String kbId;
    private final String stageRunKey;
    private final String taskType;
    private final String payloadJson;
    private final String errorMessage;
    private final Integer retryCount;
    private final String incidentStatus;
    private final String compensationAction;
    private final Instant createdAt;
    private final Instant updatedAt;

    public TaskDlqIncident(Long id,
                           String messageId,
                           String sourceQueue,
                           String sourceRoutingKey,
                           String dlqType,
                           Long taskRecordId,
                           Long parentTaskRecordId,
                           String projectId,
                           String kbId,
                           String stageRunKey,
                           String taskType,
                           String payloadJson,
                           String errorMessage,
                           Integer retryCount,
                           String incidentStatus,
                           String compensationAction,
                           Instant createdAt,
                           Instant updatedAt) {
        this.id = id;
        this.messageId = messageId;
        this.sourceQueue = sourceQueue;
        this.sourceRoutingKey = sourceRoutingKey;
        this.dlqType = dlqType;
        this.taskRecordId = taskRecordId;
        this.parentTaskRecordId = parentTaskRecordId;
        this.projectId = projectId;
        this.kbId = kbId;
        this.stageRunKey = stageRunKey;
        this.taskType = taskType;
        this.payloadJson = payloadJson;
        this.errorMessage = errorMessage;
        this.retryCount = retryCount;
        this.incidentStatus = incidentStatus;
        this.compensationAction = compensationAction;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public static TaskDlqIncident newOpenIncident(String messageId,
                                                  String sourceQueue,
                                                  String sourceRoutingKey,
                                                  String dlqType,
                                                  Long taskRecordId,
                                                  Long parentTaskRecordId,
                                                  String projectId,
                                                  String kbId,
                                                  String stageRunKey,
                                                  String taskType,
                                                  String payloadJson,
                                                  String errorMessage,
                                                  Integer retryCount,
                                                  Instant now) {
        Instant createdAt = now == null ? Instant.now() : now;
        return new TaskDlqIncident(
                null,
                messageId,
                sourceQueue,
                sourceRoutingKey,
                dlqType,
                taskRecordId,
                parentTaskRecordId,
                projectId,
                kbId,
                stageRunKey,
                taskType,
                payloadJson,
                errorMessage,
                retryCount,
                STATUS_OPEN,
                null,
                createdAt,
                createdAt
        );
    }

    public Long getId() {
        return id;
    }

    public String getMessageId() {
        return messageId;
    }

    public String getSourceQueue() {
        return sourceQueue;
    }

    public String getSourceRoutingKey() {
        return sourceRoutingKey;
    }

    public String getDlqType() {
        return dlqType;
    }

    public Long getTaskRecordId() {
        return taskRecordId;
    }

    public Long getParentTaskRecordId() {
        return parentTaskRecordId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getKbId() {
        return kbId;
    }

    public String getStageRunKey() {
        return stageRunKey;
    }

    public String getTaskType() {
        return taskType;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public Integer getRetryCount() {
        return retryCount;
    }

    public String getIncidentStatus() {
        return incidentStatus;
    }

    public String getCompensationAction() {
        return compensationAction;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public TaskDlqIncident withCompensation(String action, Instant now) {
        return withStatus(STATUS_COMPENSATED, action, now);
    }

    public TaskDlqIncident withCompensationFailure(String action, String errorMessage, Instant now) {
        Instant updated = now == null ? Instant.now() : now;
        return new TaskDlqIncident(
                id,
                messageId,
                sourceQueue,
                sourceRoutingKey,
                dlqType,
                taskRecordId,
                parentTaskRecordId,
                projectId,
                kbId,
                stageRunKey,
                taskType,
                payloadJson,
                errorMessage,
                retryCount,
                STATUS_OPEN,
                action,
                createdAt,
                updated
        );
    }

    public TaskDlqIncident withStatus(String status, Instant now) {
        return withStatus(status, compensationAction, now);
    }

    private TaskDlqIncident withStatus(String status, String action, Instant now) {
        Instant updated = now == null ? Instant.now() : now;
        return new TaskDlqIncident(
                id,
                messageId,
                sourceQueue,
                sourceRoutingKey,
                dlqType,
                taskRecordId,
                parentTaskRecordId,
                projectId,
                kbId,
                stageRunKey,
                taskType,
                payloadJson,
                errorMessage,
                retryCount,
                status,
                action,
                createdAt,
                updated
        );
    }
}
