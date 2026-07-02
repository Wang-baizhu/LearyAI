// Responsibility: Project invite create request payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import jakarta.validation.constraints.Min;

import java.time.Instant;

public class ProjectInviteCreateRequest {
    @Min(1)
    private Integer maxUse;

    private Instant expiresAt;

    public Integer getMaxUse() {
        return maxUse;
    }

    public void setMaxUse(Integer maxUse) {
        this.maxUse = maxUse;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }
}
