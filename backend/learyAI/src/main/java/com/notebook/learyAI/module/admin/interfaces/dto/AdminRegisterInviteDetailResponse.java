// Responsibility: Response payload for admin register invite detail.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.time.Instant;

public class AdminRegisterInviteDetailResponse {
    private final long inviteId;
    private final String code;
    private final String status;
    private final Long createdBy;
    private final Long usedByUserId;
    private final Instant usedAt;
    private final Instant createdAt;
    private final Instant updatedAt;

    public AdminRegisterInviteDetailResponse(long inviteId,
                                             String code,
                                             String status,
                                             Long createdBy,
                                             Long usedByUserId,
                                             Instant usedAt,
                                             Instant createdAt,
                                             Instant updatedAt) {
        this.inviteId = inviteId;
        this.code = code;
        this.status = status;
        this.createdBy = createdBy;
        this.usedByUserId = usedByUserId;
        this.usedAt = usedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public long getInviteId() {
        return inviteId;
    }

    public String getCode() {
        return code;
    }

    public String getStatus() {
        return status;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public Long getUsedByUserId() {
        return usedByUserId;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
