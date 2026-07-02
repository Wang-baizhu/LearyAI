// Responsibility: Encapsulate normalization and lifecycle rules for register invites.
package com.notebook.learyAI.module.auth.domain.service;

import com.notebook.learyAI.module.auth.domain.model.RegisterInvite;
import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;
import com.notebook.learyAI.shared.exception.BizException;

import java.time.Instant;
import java.util.Locale;

public final class RegisterInviteDomainService {
    private static final int MAX_CODE_LENGTH = 64;

    public String normalizeCode(String code, String errorCode, String errorMessage) {
        if (code == null || code.isBlank()) {
            throw new BizException(errorCode, errorMessage);
        }
        String normalized = code.trim().toUpperCase(Locale.ROOT);
        if (normalized.length() > MAX_CODE_LENGTH) {
            throw new BizException(errorCode, errorMessage);
        }
        return normalized;
    }

    public void requireCanUse(RegisterInvite invite) {
        if (invite.getStatus() == RegisterInviteStatus.INACTIVE) {
            throw new BizException("REGISTER_INVITE_INACTIVE", "注册失败：邀请码已停用");
        }
        if (invite.getStatus() == RegisterInviteStatus.USED) {
            throw new BizException("REGISTER_INVITE_USED", "注册失败：邀请码已使用");
        }
    }

    public RegisterInvite markUsed(RegisterInvite invite, Long userId, Instant now) {
        requireCanUse(invite);
        return invite.markUsed(userId, now);
    }

    public RegisterInvite deactivate(RegisterInvite invite, Instant now) {
        if (invite.getStatus() == RegisterInviteStatus.USED) {
            throw new BizException("REGISTER_INVITE_STATE_INVALID", "已使用的邀请码不能停用");
        }
        if (invite.getStatus() == RegisterInviteStatus.INACTIVE) {
            return invite;
        }
        return invite.withStatus(RegisterInviteStatus.INACTIVE, now);
    }
}
