// Responsibility: Project invite create response payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import java.time.Instant;

public class ProjectInviteCreateResponse {
    private final Long id;
    private final String code;
    private final String status;
    private final Instant expiresAt;

    public ProjectInviteCreateResponse(Long id, String code, String status, Instant expiresAt) {
        this.id = id;
        this.code = code;
        this.status = status;
        this.expiresAt = expiresAt;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public String getStatus() {
        return status;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
