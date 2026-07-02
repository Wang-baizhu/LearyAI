// Responsibility: Task retry request payload.
package com.notebook.learyAI.module.task.interfaces.dto;

public class TaskRetryRequest {
    private String projectId;
    private String kbId;

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
}
