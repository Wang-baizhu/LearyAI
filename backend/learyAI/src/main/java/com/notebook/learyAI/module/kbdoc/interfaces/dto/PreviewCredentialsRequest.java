// Responsibility: Request payload for STS credentials issuance.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class PreviewCredentialsRequest {
    @NotBlank
    @Size(max = 36)
    private String projectId;

    @NotBlank
    private String docId;

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
}
