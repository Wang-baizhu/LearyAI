// Responsibility: URL import response payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public class UrlImportResponse {
    private final String docId;
    @Schema(type = "string")
    private final String taskId;
    private final String status;

    public UrlImportResponse(String docId, String taskId, String status) {
        this.docId = docId;
        this.taskId = taskId;
        this.status = status;
    }

    public String getDocId() {
        return docId;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getStatus() {
        return status;
    }
}
