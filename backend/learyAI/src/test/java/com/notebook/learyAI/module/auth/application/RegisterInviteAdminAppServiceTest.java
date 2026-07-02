// Responsibility: Verify register invite admin management and registration claim rules.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.module.auth.domain.model.RegisterInvite;
import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;
import com.notebook.learyAI.module.auth.domain.repository.RegisterInviteRepository;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RegisterInviteAdminAppServiceTest {
    @Mock
    private PlatformAdminGuard platformAdminGuard;
    @Mock
    private RegisterInviteRepository registerInviteRepository;

    @InjectMocks
    private RegisterInviteAdminAppService registerInviteAdminAppService;

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("createInvite: 空 code 时应自动生成 ACTIVE 邀请码")
    void createInvite_whenCodeBlank_shouldGenerateInvite() {
        CurrentUserContext.setUserId(9L);
        when(registerInviteRepository.existsByCode(any())).thenReturn(false);
        when(registerInviteRepository.save(any(RegisterInvite.class))).thenAnswer(invocation -> {
            RegisterInvite invite = invocation.getArgument(0);
            return new RegisterInvite(1L, invite.getCode(), invite.getStatus(), invite.getCreatedBy(),
                    invite.getUsedByUserId(), invite.getUsedAt(), invite.getCreatedAt(), invite.getUpdatedAt());
        });

        RegisterInviteAdminAppService.RegisterInviteItemView result = registerInviteAdminAppService.createInvite(" ");

        assertEquals(1L, result.inviteId());
        assertEquals("ACTIVE", result.status());
        assertNotNull(result.code());
        assertEquals(10, result.code().length());
        verify(platformAdminGuard).requireAdmin();
    }

    @Test
    @DisplayName("createInvites: 批量创建时应返回多条 ACTIVE 邀请码")
    void createInvites_shouldCreateMultipleInvites() {
        CurrentUserContext.setUserId(9L);
        when(registerInviteRepository.existsByCode(any())).thenReturn(false);
        when(registerInviteRepository.save(any(RegisterInvite.class))).thenAnswer(invocation -> {
            RegisterInvite invite = invocation.getArgument(0);
            long id = invite.getCode().hashCode();
            return new RegisterInvite(id, invite.getCode(), invite.getStatus(), invite.getCreatedBy(),
                    invite.getUsedByUserId(), invite.getUsedAt(), invite.getCreatedAt(), invite.getUpdatedAt());
        });

        var result = registerInviteAdminAppService.createInvites(null, 3);

        assertEquals(3, result.size());
        assertEquals("ACTIVE", result.get(0).status());
        verify(platformAdminGuard).requireAdmin();
    }

    @Test
    @DisplayName("claimInviteForRegistration: 不存在时返回 REGISTER_INVITE_INVALID")
    void claimInviteForRegistration_whenNotFound_shouldThrowInvalid() {
        when(registerInviteRepository.findByCode("INVITE-404")).thenReturn(Optional.empty());

        BizException ex = assertThrows(BizException.class,
                () -> registerInviteAdminAppService.claimInviteForRegistration("invite-404", 11L, Instant.now()));

        assertEquals("REGISTER_INVITE_INVALID", ex.getCode());
    }

    @Test
    @DisplayName("claimInviteForRegistration: ACTIVE 邀请码应标记为 USED")
    void claimInviteForRegistration_whenActive_shouldMarkUsed() {
        Instant now = Instant.parse("2026-06-10T08:00:00Z");
        RegisterInvite invite = new RegisterInvite(2L, "INVITE-001", RegisterInviteStatus.ACTIVE, 1L,
                null, null, now.minusSeconds(3600), now.minusSeconds(3600));
        when(registerInviteRepository.findByCode("INVITE-001")).thenReturn(Optional.of(invite));
        when(registerInviteRepository.markUsedIfActive(2L, 22L, now)).thenReturn(true);

        RegisterInvite result = registerInviteAdminAppService.claimInviteForRegistration("invite-001", 22L, now);

        assertEquals(RegisterInviteStatus.USED, result.getStatus());
        assertEquals(22L, result.getUsedByUserId());
        assertEquals(now, result.getUsedAt());
    }

    @Test
    @DisplayName("claimInviteForRegistration: 并发竞争失败后应返回已使用错误")
    void claimInviteForRegistration_whenConcurrentClaimLoses_shouldThrowUsed() {
        Instant now = Instant.parse("2026-06-10T08:00:00Z");
        RegisterInvite activeInvite = new RegisterInvite(2L, "INVITE-001", RegisterInviteStatus.ACTIVE, 1L,
                null, null, now.minusSeconds(3600), now.minusSeconds(3600));
        RegisterInvite usedInvite = new RegisterInvite(2L, "INVITE-001", RegisterInviteStatus.USED, 1L,
                33L, now.minusSeconds(30), now.minusSeconds(3600), now.minusSeconds(30));
        when(registerInviteRepository.findByCode("INVITE-001")).thenReturn(Optional.of(activeInvite));
        when(registerInviteRepository.markUsedIfActive(2L, 22L, now)).thenReturn(false);
        when(registerInviteRepository.findById(2L)).thenReturn(Optional.of(usedInvite));

        BizException ex = assertThrows(BizException.class,
                () -> registerInviteAdminAppService.claimInviteForRegistration("invite-001", 22L, now));

        assertEquals("REGISTER_INVITE_USED", ex.getCode());
        verify(registerInviteRepository, never()).save(any(RegisterInvite.class));
    }

    @Test
    @DisplayName("deactivateInvite: USED 邀请码不能停用")
    void deactivateInvite_whenUsed_shouldThrowStateInvalid() {
        RegisterInvite invite = new RegisterInvite(3L, "INVITE-USED", RegisterInviteStatus.USED, 1L,
                22L, Instant.now(), Instant.now(), Instant.now());
        when(registerInviteRepository.findById(3L)).thenReturn(Optional.of(invite));

        BizException ex = assertThrows(BizException.class,
                () -> registerInviteAdminAppService.deactivateInvite("3"));

        assertEquals("REGISTER_INVITE_STATE_INVALID", ex.getCode());
        verify(platformAdminGuard).requireAdmin();
    }
}
