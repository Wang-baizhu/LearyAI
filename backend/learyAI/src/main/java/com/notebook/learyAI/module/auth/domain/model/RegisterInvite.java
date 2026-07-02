// Responsibility: Represent a registration invite owned by the auth module.
package com.notebook.learyAI.module.auth.domain.model;

import java.time.Instant;

public class RegisterInvite {
    private final Long id;
    private final String code;
    private final RegisterInviteStatus status;
    private final Long createdBy;
    private final Long usedByUserId;
    private final Instant usedAt;
    private final Instant createdAt;
    private final Instant updatedAt;

    public RegisterInvite(Long id,
                          String code,
                          RegisterInviteStatus status,
                          Long createdBy,
                          Long usedByUserId,
                          Instant usedAt,
                          Instant createdAt,
                          Instant updatedAt) {
        this.id = id;
        this.code = code;
        this.status = status;
        this.createdBy = createdBy;
        this.usedByUserId = usedByUserId;
        this.usedAt = usedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public RegisterInvite withStatus(RegisterInviteStatus nextStatus, Instant nextUpdatedAt) {
        return new RegisterInvite(id, code, nextStatus, createdBy, usedByUserId, usedAt, createdAt, nextUpdatedAt);
    }

    public RegisterInvite markUsed(Long nextUsedByUserId, Instant nextUsedAt) {
        return new RegisterInvite(id, code, RegisterInviteStatus.USED, createdBy, nextUsedByUserId, nextUsedAt,
                createdAt, nextUsedAt);
    }

    public Long getId() {
        return id;
    }

    public String getCode() {
        return code;
    }

    public RegisterInviteStatus getStatus() {
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
