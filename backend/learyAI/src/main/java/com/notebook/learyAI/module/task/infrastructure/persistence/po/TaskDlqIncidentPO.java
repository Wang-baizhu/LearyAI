// Responsibility: JPA entity mapping for task_dlq_incident table.
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

@Entity
@Table(name = "task_dlq_incident",
        uniqueConstraints = {
                @UniqueConstraint(name = "uk_task_dlq_incident_message_queue", columnNames = {"message_id", "source_queue"})
        },
        indexes = {
                @Index(name = "idx_task_dlq_incident_status_created", columnList = "incident_status,created_at"),
                @Index(name = "idx_task_dlq_incident_task", columnList = "project_id,task_record_id")
        })
public class TaskDlqIncidentPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "message_id", nullable = false, length = 128)
    private String messageId;

    @Column(name = "source_queue", nullable = false, length = 128)
    private String sourceQueue;

    @Column(name = "source_routing_key", length = 128)
    private String sourceRoutingKey;

    @Column(name = "dlq_type", nullable = false, length = 32)
    private String dlqType;

    @Column(name = "task_record_id")
    private Long taskRecordId;

    @Column(name = "parent_task_record_id")
    private Long parentTaskRecordId;

    @Column(name = "project_id", length = 64)
    private String projectId;

    @Column(name = "kb_id", length = 64)
    private String kbId;

    @Column(name = "stage_run_key", length = 128)
    private String stageRunKey;

    @Column(name = "task_type", length = 64)
    private String taskType;

    @Column(name = "payload_json", columnDefinition = "text")
    private String payloadJson;

    @Column(name = "error_message", columnDefinition = "text")
    private String errorMessage;

    @Column(name = "retry_count")
    private Integer retryCount;

    @Column(name = "incident_status", nullable = false, length = 32)
    private String incidentStatus;

    @Column(name = "compensation_action", length = 128)
    private String compensationAction;

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

    public String getMessageId() {
        return messageId;
    }

    public void setMessageId(String messageId) {
        this.messageId = messageId;
    }

    public String getSourceQueue() {
        return sourceQueue;
    }

    public void setSourceQueue(String sourceQueue) {
        this.sourceQueue = sourceQueue;
    }

    public String getSourceRoutingKey() {
        return sourceRoutingKey;
    }

    public void setSourceRoutingKey(String sourceRoutingKey) {
        this.sourceRoutingKey = sourceRoutingKey;
    }

    public String getDlqType() {
        return dlqType;
    }

    public void setDlqType(String dlqType) {
        this.dlqType = dlqType;
    }

    public Long getTaskRecordId() {
        return taskRecordId;
    }

    public void setTaskRecordId(Long taskRecordId) {
        this.taskRecordId = taskRecordId;
    }

    public Long getParentTaskRecordId() {
        return parentTaskRecordId;
    }

    public void setParentTaskRecordId(Long parentTaskRecordId) {
        this.parentTaskRecordId = parentTaskRecordId;
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

    public String getStageRunKey() {
        return stageRunKey;
    }

    public void setStageRunKey(String stageRunKey) {
        this.stageRunKey = stageRunKey;
    }

    public String getTaskType() {
        return taskType;
    }

    public void setTaskType(String taskType) {
        this.taskType = taskType;
    }

    public String getPayloadJson() {
        return payloadJson;
    }

    public void setPayloadJson(String payloadJson) {
        this.payloadJson = payloadJson;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public Integer getRetryCount() {
        return retryCount;
    }

    public void setRetryCount(Integer retryCount) {
        this.retryCount = retryCount;
    }

    public String getIncidentStatus() {
        return incidentStatus;
    }

    public void setIncidentStatus(String incidentStatus) {
        this.incidentStatus = incidentStatus;
    }

    public String getCompensationAction() {
        return compensationAction;
    }

    public void setCompensationAction(String compensationAction) {
        this.compensationAction = compensationAction;
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
