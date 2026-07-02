// Responsibility: Task list item payload.
package com.notebook.learyAI.module.task.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.Map;

public class TaskListItemResponse {
    @Schema(type = "string")
    private final String taskId;
    private final String type;
    private final String typeId;
    private final String status;
    private final String currentStage;
    private final Map<String, Object> viewData;
    private final Instant createdAt;
    private final Instant updatedAt;

    public TaskListItemResponse(String taskId, String type, String typeId, String status, String currentStage,
                                Map<String, Object> viewData,
                                Instant createdAt, Instant updatedAt) {
        this.taskId = taskId;
        this.type = type;
        this.typeId = typeId;
        this.status = status;
        this.currentStage = currentStage;
        this.viewData = viewData;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getType() {
        return type;
    }

    public String getTypeId() {
        return typeId;
    }

    public String getStatus() {
        return status;
    }

    public String getCurrentStage() {
        return currentStage;
    }

    public Map<String, Object> getViewData() {
        return viewData;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
