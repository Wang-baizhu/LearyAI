// Responsibility: Response item payload for admin invite list and detail.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.time.Instant;

public class AdminInviteItemResponse {
    private final long inviteId;
    private final String projectId;
    private final long creatorUserId;
    private final String status;
    private final Instant expiresAt;
    private final Instant revokedAt;
    private final int maxUses;
    private final int usedCount;
    private final Instant createdAt;
    private final Instant updatedAt;

    public AdminInviteItemResponse(long inviteId,
                                   String projectId,
                                   long creatorUserId,
                                   String status,
                                   Instant expiresAt,
                                   Instant revokedAt,
                                   int maxUses,
                                   int usedCount,
                                   Instant createdAt,
                                   Instant updatedAt) {
        this.inviteId = inviteId;
        this.projectId = projectId;
        this.creatorUserId = creatorUserId;
        this.status = status;
        this.expiresAt = expiresAt;
        this.revokedAt = revokedAt;
        this.maxUses = maxUses;
        this.usedCount = usedCount;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public long getInviteId() {
        return inviteId;
    }

    public String getProjectId() {
        return projectId;
    }

    public long getCreatorUserId() {
        return creatorUserId;
    }

    public String getStatus() {
        return status;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public Instant getRevokedAt() {
        return revokedAt;
    }

    public int getMaxUses() {
        return maxUses;
    }

    public int getUsedCount() {
        return usedCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
