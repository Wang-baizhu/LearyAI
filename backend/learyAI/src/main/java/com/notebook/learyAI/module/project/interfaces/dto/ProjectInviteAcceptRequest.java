// Responsibility: Project invite accept request payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ProjectInviteAcceptRequest {
    @NotBlank
    @Size(max = 64)
    private String inviteCode;

    public String getInviteCode() {
        return inviteCode;
    }

    public void setInviteCode(String inviteCode) {
        this.inviteCode = inviteCode;
    }
}
