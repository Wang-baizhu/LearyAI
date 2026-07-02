// Responsibility: Response item payload for paged admin task DLQ incident list.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.time.Instant;

public class AdminTaskDlqIncidentItemResponse {
    private final Long incidentId;
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

    public AdminTaskDlqIncidentItemResponse(Long incidentId,
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
        this.incidentId = incidentId;
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

    public Long getIncidentId() {
        return incidentId;
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
}
