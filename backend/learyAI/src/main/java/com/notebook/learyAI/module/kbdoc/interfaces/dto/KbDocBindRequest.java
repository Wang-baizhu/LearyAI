// Responsibility: Bind or unbind doc to knowledge base request payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class KbDocBindRequest {
    @NotBlank
    @Size(max = 36)
    private String projectId;

    @NotBlank
    private String docId;

    @NotBlank
    private String kbId;

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getDocId() {
        return docId;
    }

    public void setDocId(String docId) {
        this.docId = docId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }
}
