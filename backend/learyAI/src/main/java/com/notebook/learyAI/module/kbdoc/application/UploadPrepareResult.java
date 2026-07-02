// Responsibility: Carry upload preparation result details.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.shared.storage.TemporaryUrl;
import com.notebook.learyAI.shared.storage.UploadPolicy;

public class UploadPrepareResult {
    private final String docId;
    private final String taskId;
    private final String objectKey;
    private final UploadPolicy uploadPolicy;
    private final TemporaryUrl temporaryUrl;

    public UploadPrepareResult(String docId, String taskId, String objectKey, UploadPolicy uploadPolicy,
                               TemporaryUrl temporaryUrl) {
        this.docId = docId;
        this.taskId = taskId;
        this.objectKey = objectKey;
        this.uploadPolicy = uploadPolicy;
        this.temporaryUrl = temporaryUrl;
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

    public UploadPolicy getUploadPolicy() {
        return uploadPolicy;
    }

    public TemporaryUrl getTemporaryUrl() {
        return temporaryUrl;
    }
}
