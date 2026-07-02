// Responsibility: Project invite response payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import java.time.Instant;

public class ProjectInviteResponse {
    private final Long id;
    private final String code;
    private final Long creatorId;
    private final int maxUse;
    private final int usedCount;
    private final String status;
    private final Instant expiresAt;
    private final Instant createdAt;

    public ProjectInviteResponse(Long id, String code, Long creatorId, int maxUse, int usedCount, String status,
                                 Instant expiresAt, Instant createdAt) {
        this.id = id;
        this.code = code;
        this.creatorId = creatorId;
        this.maxUse = maxUse;
        this.usedCount = usedCount;
        this.status = status;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public Long getCreatorId() {
        return creatorId;
    }

    public int getMaxUse() {
        return maxUse;
    }

    public int getUsedCount() {
        return usedCount;
    }

    public String getStatus() {
        return status;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
