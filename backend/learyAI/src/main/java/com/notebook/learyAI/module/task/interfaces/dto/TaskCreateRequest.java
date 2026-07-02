// Responsibility: Task creation request payload.
package com.notebook.learyAI.module.task.interfaces.dto;

import java.util.Map;

public class TaskCreateRequest {
    private String projectId;
    private String kbId;
    private String type;
    private String typeId;
    private String status;
    private Map<String, Object> pipelineContext;
    private String info;
    private String changeType;

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

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getTypeId() {
        return typeId;
    }

    public void setTypeId(String typeId) {
        this.typeId = typeId;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Map<String, Object> getPipelineContext() {
        return pipelineContext;
    }

    public void setPipelineContext(Map<String, Object> pipelineContext) {
        this.pipelineContext = pipelineContext;
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
