// Responsibility: Upload prepare response payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public class UploadPrepareResponse {
    private final String docId;
    @Schema(type = "string")
    private final String taskId;
    private final String objectKey;
    private final UploadPolicyResponse uploadPolicy;
    private final String tempUrl;
    private final java.time.Instant tempUrlExpiresAt;

    public UploadPrepareResponse(String docId, String taskId, String objectKey, UploadPolicyResponse uploadPolicy,
                                 String tempUrl, java.time.Instant tempUrlExpiresAt) {
        this.docId = docId;
        this.taskId = taskId;
        this.objectKey = objectKey;
        this.uploadPolicy = uploadPolicy;
        this.tempUrl = tempUrl;
        this.tempUrlExpiresAt = tempUrlExpiresAt;
    }

    public String getDocId() {
        return docId;
    }

    public String getTaskId() {
        return taskId;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public UploadPolicyResponse getUploadPolicy() {
        return uploadPolicy;
    }

    public String getTempUrl() {
        return tempUrl;
    }

    public java.time.Instant getTempUrlExpiresAt() {
        return tempUrlExpiresAt;
    }
}
