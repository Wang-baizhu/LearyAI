// Responsibility: Task status update request payload.
package com.notebook.learyAI.module.task.interfaces.dto;

import java.util.Map;

public class TaskStatusUpdateRequest {
    private String projectId;
    private String status;
    private Map<String, Object> viewPatch;
    private String info;
    private String changeType;

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Map<String, Object> getViewPatch() {
        return viewPatch;
    }

    public void setViewPatch(Map<String, Object> viewPatch) {
        this.viewPatch = viewPatch;
    }

    public String getInfo() {
        return info;
    }

    public void setInfo(String info) {
        this.info = info;
    }

    public String getChangeType() {
        return changeType;
    }

    public void setChangeType(String changeType) {
        this.changeType = changeType;
    }
}
