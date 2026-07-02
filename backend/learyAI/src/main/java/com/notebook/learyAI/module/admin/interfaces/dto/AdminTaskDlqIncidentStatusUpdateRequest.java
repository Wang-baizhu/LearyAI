// Responsibility: Request payload for admin task DLQ incident status updates.
package com.notebook.learyAI.module.admin.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

public class AdminTaskDlqIncidentStatusUpdateRequest {
    @NotBlank
    private String incidentStatus;

    public String getIncidentStatus() {
        return incidentStatus;
    }

    public void setIncidentStatus(String incidentStatus) {
        this.incidentStatus = incidentStatus;
    }
}
