// Responsibility: Own register-invite management use cases and admin-facing query views.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.module.auth.domain.model.RegisterInvite;
import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;
import com.notebook.learyAI.module.auth.domain.repository.RegisterInviteRepository;
import com.notebook.learyAI.module.auth.domain.service.RegisterInviteDomainService;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Random;
import java.util.Set;

@Service
public class RegisterInviteAdminAppService {
    private static final int CODE_LENGTH = 10;
    private static final int MAX_GENERATE_RETRY = 8;
    private static final String CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final Set<String> ALLOWED_STATUS = Set.of("ACTIVE", "INACTIVE", "USED");

    private final PlatformAdminGuard platformAdminGuard;
    private final RegisterInviteRepository registerInviteRepository;
    private final RegisterInviteDomainService registerInviteDomainService = new RegisterInviteDomainService();
    private final Random random = new Random();

    public RegisterInviteAdminAppService(PlatformAdminGuard platformAdminGuard,
                                         RegisterInviteRepository registerInviteRepository) {
        this.platformAdminGuard = platformAdminGuard;
        this.registerInviteRepository = registerInviteRepository;
    }

    @Transactional
    public RegisterInviteItemView createInvite(String code) {
        platformAdminGuard.requireAdmin();
        return createInviteInternal(code, Instant.now());
    }

    @Transactional
    public List<RegisterInviteItemView> createInvites(String code, Integer count) {
        platformAdminGuard.requireAdmin();
        int normalizedCount = normalizeCreateCount(count);
        if (normalizedCount > 1 && code != null && !code.isBlank()) {
            throw new BizException("VALIDATION_ERROR", "批量创建时不支持自定义单个 code");
        }
        Instant now = Instant.now();
        List<RegisterInviteItemView> items = new ArrayList<>(normalizedCount);
        for (int index = 0; index < normalizedCount; index++) {
            items.add(createInviteInternal(code, now));
        }
        return items;
    }

    private RegisterInviteItemView createInviteInternal(String code, Instant now) {
        String normalizedCode = code == null || code.isBlank() ? generateCode() :
                registerInviteDomainService.normalizeCode(code, "VALIDATION_ERROR", "code invalid");
        if (registerInviteRepository.existsByCode(normalizedCode)) {
            throw new BizException("REGISTER_INVITE_CODE_EXISTS", "邀请码已存在");
        }
        RegisterInvite saved = registerInviteRepository.save(new RegisterInvite(
                null,
                normalizedCode,
                RegisterInviteStatus.ACTIVE,
                CurrentUserContext.getUserId(),
                null,
                null,
                now,
                now
        ));
        return toItem(saved);
    }

    public RegisterInvitePageView listInvites(String status, int page, int size) {
        platformAdminGuard.requireAdmin();
        validatePaging(page, size);
        RegisterInviteStatus normalizedStatus = normalizeStatus(status);
        RegisterInviteRepository.RegisterInvitePageResult result = registerInviteRepository.findPage(normalizedStatus, page, size);
        return new RegisterInvitePageView(page, size, result.total(), result.items().stream().map(this::toItem).toList());
    }

    public RegisterInviteItemView getInviteDetail(String inviteId) {
        platformAdminGuard.requireAdmin();
        long normalizedInviteId = parseInviteId(inviteId);
        RegisterInvite invite = registerInviteRepository.findById(normalizedInviteId)
                .orElseThrow(() -> new BizException("REGISTER_INVITE_NOT_FOUND", "register invite not found"));
        return toItem(invite);
    }

    @Transactional
    public RegisterInviteItemView deactivateInvite(String inviteId) {
        platformAdminGuard.requireAdmin();
        long normalizedInviteId = parseInviteId(inviteId);
        RegisterInvite invite = registerInviteRepository.findById(normalizedInviteId)
                .orElseThrow(() -> new BizException("REGISTER_INVITE_NOT_FOUND", "register invite not found"));
        RegisterInvite updated = registerInviteDomainService.deactivate(invite, Instant.now());
        if (updated == invite) {
            return toItem(invite);
        }
        return toItem(registerInviteRepository.save(updated));
    }

    @Transactional
    public void deleteInvite(String inviteId) {
        platformAdminGuard.requireAdmin();
        long normalizedInviteId = parseInviteId(inviteId);
        RegisterInvite invite = registerInviteRepository.findById(normalizedInviteId)
                .orElseThrow(() -> new BizException("REGISTER_INVITE_NOT_FOUND", "register invite not found"));
        if (invite.getStatus() == RegisterInviteStatus.USED) {
            throw new BizException("REGISTER_INVITE_STATE_INVALID", "已使用的邀请码不能删除");
        }
        registerInviteRepository.deleteById(normalizedInviteId);
    }

    public String normalizeInviteCode(String inviteCode) {
        return registerInviteDomainService.normalizeCode(inviteCode, "REGISTER_INVITE_INVALID", "注册失败：邀请码无效");
    }

    public RegisterInvite claimInviteForRegistration(String inviteCode, Long userId, Instant now) {
        String normalizedCode = normalizeInviteCode(inviteCode);
        RegisterInvite invite = registerInviteRepository.findByCode(normalizedCode)
                .orElseThrow(() -> new BizException("REGISTER_INVITE_INVALID", "注册失败：邀请码无效"));
        RegisterInvite claimed = registerInviteDomainService.markUsed(invite, userId, now);
        if (registerInviteRepository.markUsedIfActive(invite.getId(), userId, now)) {
            return claimed;
        }
        RegisterInvite latest = registerInviteRepository.findById(invite.getId())
                .orElseThrow(() -> new BizException("REGISTER_INVITE_INVALID", "注册失败：邀请码无效"));
        registerInviteDomainService.requireCanUse(latest);
        throw new IllegalStateException("failed to claim active register invite: " + invite.getId());
    }

    private RegisterInviteStatus normalizeStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!ALLOWED_STATUS.contains(normalized)) {
            throw new BizException("VALIDATION_ERROR", "status invalid");
        }
        return RegisterInviteStatus.valueOf(normalized);
    }

    private long parseInviteId(String inviteId) {
        if (inviteId == null || inviteId.isBlank()) {
            throw new BizException("VALIDATION_ERROR", "inviteId invalid");
        }
        try {
            long value = Long.parseLong(inviteId.trim());
            if (value <= 0) {
                throw new BizException("VALIDATION_ERROR", "inviteId invalid");
            }
            return value;
        } catch (NumberFormatException ex) {
            throw new BizException("VALIDATION_ERROR", "inviteId invalid");
        }
    }

    private void validatePaging(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new BizException("VALIDATION_ERROR", "page or size invalid");
        }
    }

    private int normalizeCreateCount(Integer count) {
        int resolved = count == null ? 1 : count;
        if (resolved < 1 || resolved > 100) {
            throw new BizException("VALIDATION_ERROR", "count invalid");
        }
        return resolved;
    }

    private String generateCode() {
        for (int attempt = 0; attempt < MAX_GENERATE_RETRY; attempt++) {
            StringBuilder builder = new StringBuilder(CODE_LENGTH);
            for (int index = 0; index < CODE_LENGTH; index++) {
                builder.append(CODE_CHARS.charAt(random.nextInt(CODE_CHARS.length())));
            }
            String code = builder.toString();
            if (!registerInviteRepository.existsByCode(code)) {
                return code;
            }
        }
        throw new BizException("REGISTER_INVITE_GENERATE_FAILED", "邀请码生成失败");
    }

    private RegisterInviteItemView toItem(RegisterInvite invite) {
        return new RegisterInviteItemView(
                invite.getId(),
                invite.getCode(),
                invite.getStatus().name(),
                invite.getCreatedBy(),
                invite.getUsedByUserId(),
                invite.getUsedAt(),
                invite.getCreatedAt(),
                invite.getUpdatedAt()
        );
    }

    private RegisterInviteItemView toItem(RegisterInviteRepository.RegisterInviteRow row) {
        return new RegisterInviteItemView(
                row.inviteId(),
                row.code(),
                row.status().name(),
                row.createdBy(),
                row.usedByUserId(),
                row.usedAt(),
                row.createdAt(),
                row.updatedAt()
        );
    }

    public record RegisterInvitePageView(int page, int size, long total, java.util.List<RegisterInviteItemView> items) {
    }

    public record RegisterInviteItemView(Long inviteId,
                                         String code,
                                         String status,
                                         Long createdBy,
                                         Long usedByUserId,
                                         Instant usedAt,
                                         Instant createdAt,
                                         Instant updatedAt) {
    }
}
