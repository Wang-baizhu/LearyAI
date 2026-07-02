// Responsibility: Carry kb doc editable metadata update payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.Map;

public class KbDocUpdateRequest {
    @NotBlank
    private String projectId;

    @NotBlank
    private String name;

    private String description;

    private Map<String, Object> documentation;

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Map<String, Object> getDocumentation() {
        return documentation;
    }

    public void setDocumentation(Map<String, Object> documentation) {
        this.documentation = documentation;
    }
}
