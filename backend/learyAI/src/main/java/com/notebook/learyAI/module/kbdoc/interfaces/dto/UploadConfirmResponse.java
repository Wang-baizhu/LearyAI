// Responsibility: Upload confirm response payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public class UploadConfirmResponse {
    @Schema(type = "string")
    private final String taskId;
    private final String status;

    public UploadConfirmResponse(String taskId, String status) {
        this.taskId = taskId;
        this.status = status;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getStatus() {
        return status;
    }
}
