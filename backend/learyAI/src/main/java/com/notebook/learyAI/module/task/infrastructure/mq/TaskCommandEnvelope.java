// Responsibility: Deserialize task.command.* DLQ envelope for backend compensation.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.notebook.learyAI.shared.exception.BizException;

import java.util.Map;

@JsonIgnoreProperties(ignoreUnknown = true)
public class TaskCommandEnvelope {
    private String messageId;
    private String schemaVersion;
    private String occurredAt;
    private String traceId;
    private String producer;
    private String projectId;
    private String kbId;
    private Long userId;
    private Long taskRecordId;
    private String taskType;
    private Long parentTaskRecordId;
    private String stageRunKey;
    private Map<String, Object> payload;

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getSchemaVersion() {
        return schemaVersion;
    }

    public void setSchemaVersion(String schemaVersion) {
        this.schemaVersion = schemaVersion;
    }

    public String getOccurredAt() {
        return occurredAt;
    }

    public void setOccurredAt(String occurredAt) {
        this.occurredAt = occurredAt;
    }

    public String getTraceId() {
        return traceId;
    }

    public void setTraceId(String traceId) {
        this.traceId = traceId;
    }

    public String getProducer() {
        return producer;
    }

    public void setProducer(String producer) {
        this.producer = producer;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Long getTaskRecordId() {
        return taskRecordId;
    }

    public void setTaskRecordId(Long taskRecordId) {
        this.taskRecordId = taskRecordId;
    }

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public Long getParentTaskRecordId() {
        return parentTaskRecordId;
    }

    public void setParentTaskRecordId(Long parentTaskRecordId) {
        this.parentTaskRecordId = parentTaskRecordId;
    }

    public String getStageRunKey() {
        return stageRunKey;
    }

    public void setStageRunKey(String stageRunKey) {
        this.stageRunKey = stageRunKey;
    }

    public Map<String, Object> getPayload() {
        return payload;
    }

    public void setPayload(Map<String, Object> payload) {
        this.payload = payload;
    }

    public void validateForDlqCompensation() {
        requireText(messageId, "messageId required");
        requirePositive(taskRecordId, "taskRecordId required");
        String normalizedTaskType = requireText(taskType, "taskType required");
        requireText(projectId, "projectId required");
        if (requiresKbScope(normalizedTaskType)) {
            requireText(kbId, "kbId required");
        }
    }

    private String requireText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", message);
        }
        return value.trim();
    }

    private void requirePositive(Long value, String message) {
        if (value == null || value <= 0L) {
            throw new BizException("KB-400", message);
        }
    }

    private boolean requiresKbScope(String normalizedTaskType) {
        return "agent".equals(normalizedTaskType) || "doc".equals(normalizedTaskType);
    }
}
