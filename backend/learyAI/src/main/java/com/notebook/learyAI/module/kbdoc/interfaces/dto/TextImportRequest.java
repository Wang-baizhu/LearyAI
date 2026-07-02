// Responsibility: Text import request payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class TextImportRequest {
    @NotBlank
    @Size(max = 36)
    private String projectId;

    @NotBlank
    @Size(max = 36)
    private String kbId;

    @NotBlank
    private String text;

    private String name;

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

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
