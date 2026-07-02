// Responsibility: Represent project invite code.
package com.notebook.learyAI.module.project.domain.model;

import java.time.Instant;

public class ProjectInvite {
    private final Long id;
    private final String projectId;
    private final String code;
    private final Long creatorId;
    private final int maxUse;
    private final int usedCount;
    private final ProjectInviteStatus status;
    private final Instant expiresAt;
    private final Instant createdAt;
    private final Instant updatedAt;

    public ProjectInvite(Long id, String projectId, String code, Long creatorId, int maxUse, int usedCount,
                         ProjectInviteStatus status, Instant expiresAt, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.projectId = projectId;
        this.code = code;
        this.creatorId = creatorId;
        this.maxUse = maxUse;
        this.usedCount = usedCount;
        this.status = status;
        this.expiresAt = expiresAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public String getProjectId() {
        return projectId;
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

    public ProjectInviteStatus getStatus() {
        return status;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public ProjectInvite withUsed(int nextUsedCount, Instant updatedAt) {
        return new ProjectInvite(id, projectId, code, creatorId, maxUse, nextUsedCount, status, expiresAt,
                createdAt, updatedAt);
    }

    public ProjectInvite withStatus(ProjectInviteStatus nextStatus, Instant updatedAt) {
        return new ProjectInvite(id, projectId, code, creatorId, maxUse, usedCount, nextStatus, expiresAt,
                createdAt, updatedAt);
    }
}
