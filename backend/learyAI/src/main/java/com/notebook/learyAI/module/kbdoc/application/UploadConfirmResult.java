// Responsibility: Carry upload confirmation result details.
package com.notebook.learyAI.module.kbdoc.application;

public class UploadConfirmResult {
    private final String taskId;
    private final String status;

    public UploadConfirmResult(String taskId, String status) {
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
