// Responsibility: Project owner transfer request payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import jakarta.validation.constraints.NotNull;

public class ProjectTransferRequest {
    @NotNull
    private Long targetUserId;

    public Long getTargetUserId() {
        return targetUserId;
    }

    public void setTargetUserId(Long targetUserId) {
        this.targetUserId = targetUserId;
    }
}
