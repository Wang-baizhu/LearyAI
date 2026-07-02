// Responsibility: Encapsulate reusable project invite rules and invite usage transitions.
package com.notebook.learyAI.module.project.domain.service;

import com.notebook.learyAI.module.project.domain.model.ProjectInvite;
import com.notebook.learyAI.module.project.domain.model.ProjectInviteStatus;
import com.notebook.learyAI.shared.exception.BizException;

import java.time.Instant;

public final class ProjectInviteDomainService {
    private static final int DEFAULT_MAX_USE = 1;
    private static final int MAX_MAX_USE = 1000;

    public int resolveMaxUse(Integer maxUse, String code, String message) {
        int resolved = maxUse == null ? DEFAULT_MAX_USE : maxUse;
        if (resolved < 1 || resolved > MAX_MAX_USE) {
            throw new BizException(code, message);
        }
        return resolved;
    }

    public void requireExpiresAtNotPast(Instant expiresAt, Instant now, String code, String message) {
        if (expiresAt != null && expiresAt.isBefore(now)) {
            throw new BizException(code, message);
        }
    }

    public String normalizeCode(String code, String requiredCode, String requiredMessage) {
        if (code == null || code.isBlank()) {
            throw new BizException(requiredCode, requiredMessage);
        }
        return code.trim();
    }

    public void requireActive(ProjectInvite invite, String code, String message) {
        if (invite.getStatus() != ProjectInviteStatus.ACTIVE) {
            throw new BizException(code, message);
        }
    }

    public boolean isExpired(ProjectInvite invite, Instant now) {
        return invite.getExpiresAt() != null && invite.getExpiresAt().isBefore(now);
    }

    public ProjectInvite expire(ProjectInvite invite, Instant now) {
        return invite.withStatus(ProjectInviteStatus.EXPIRED, now);
    }

    public void requireNotExceeded(ProjectInvite invite, String code, String message) {
        if (invite.getUsedCount() >= invite.getMaxUse()) {
            throw new BizException(code, message);
        }
    }

    public ProjectInvite incrementUsage(ProjectInvite invite, Instant now) {
        return invite.withUsed(invite.getUsedCount() + 1, now);
    }
}
