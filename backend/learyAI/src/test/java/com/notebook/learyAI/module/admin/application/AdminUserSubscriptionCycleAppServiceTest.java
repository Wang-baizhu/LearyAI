// Responsibility: Verify admin-only subscription cycle management guards and delegation.
package com.notebook.learyAI.module.admin.application;

import com.notebook.learyAI.module.admin.domain.repository.AdminUserReadRepository;
import com.notebook.learyAI.module.auth.application.PlatformAdminGuard;
import com.notebook.learyAI.module.usage.application.dto.UpsertSubscriptionCycleRequestDTO;
import com.notebook.learyAI.module.usage.application.service.SubscriptionCycleAdminAppService;
import com.notebook.learyAI.module.usage.domain.model.SubscriptionCycle;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminUserSubscriptionCycleAppServiceTest {
    @Mock
    private PlatformAdminGuard platformAdminGuard;
    @Mock
    private AdminUserReadRepository adminUserReadRepository;
    @Mock
    private SubscriptionCycleAdminAppService subscriptionCycleAdminAppService;

    @InjectMocks
    private AdminUserSubscriptionCycleAppService appService;

    @Test
    @DisplayName("非 admin 时应拒绝")
    void listUserCycles_nonAdmin_shouldThrow() {
        doThrow(new BizException("ADMIN_FORBIDDEN", "platform admin required"))
                .when(platformAdminGuard).requireAdmin();

        BizException ex = assertThrows(BizException.class, () -> appService.listUserCycles(1L, null));
        assertEquals("ADMIN_FORBIDDEN", ex.getCode());
    }

    @Test
    @DisplayName("用户不存在时应返回 USER-404")
    void updateUserCycle_missingUser_shouldThrow() {
        when(adminUserReadRepository.existsByUserId(2L)).thenReturn(false);

        BizException ex = assertThrows(BizException.class,
                () -> appService.updateUserCycle(2L, "ai_chat_tokens", "pro", 100L, Instant.parse("2026-06-19T00:00:00Z"), Instant.parse("2026-07-19T00:00:00Z")));
        assertEquals("USER-404", ex.getCode());
    }

    @Test
    @DisplayName("updateUserCycle: 应透传到 usage 周期服务")
    void updateUserCycle_shouldDelegate() {
        Instant from = Instant.parse("2026-06-19T00:00:00Z");
        Instant to = Instant.parse("2026-07-19T00:00:00Z");
        when(adminUserReadRepository.existsByUserId(1L)).thenReturn(true);
        when(subscriptionCycleAdminAppService.upsertCycle(org.mockito.ArgumentMatchers.any(UpsertSubscriptionCycleRequestDTO.class)))
                .thenReturn(new SubscriptionCycle(9L, 1L, "ai_chat_tokens", "pro", 100L, from, to, "ACTIVE", from, from));

        AdminUserSubscriptionCycleAppService.SubscriptionCycleView view =
                appService.updateUserCycle(1L, "ai_chat_tokens", "pro", 100L, from, to);

        assertEquals("pro", view.planId());
        ArgumentCaptor<UpsertSubscriptionCycleRequestDTO> captor = ArgumentCaptor.forClass(UpsertSubscriptionCycleRequestDTO.class);
        verify(subscriptionCycleAdminAppService).upsertCycle(captor.capture());
        assertEquals(100L, captor.getValue().quota());
    }

    @Test
    @DisplayName("listUserCycles: 应返回映射视图")
    void listUserCycles_shouldReturnViews() {
        Instant now = Instant.parse("2026-06-19T00:00:00Z");
        when(adminUserReadRepository.existsByUserId(1L)).thenReturn(true);
        when(subscriptionCycleAdminAppService.listUserCycles(1L, "kbdoc_size"))
                .thenReturn(List.of(new SubscriptionCycle(1L, 1L, "kbdoc_size", "plus", 1024L, now, now.plusSeconds(10), "ACTIVE", now, now)));

        List<AdminUserSubscriptionCycleAppService.SubscriptionCycleView> result = appService.listUserCycles(1L, "kbdoc_size");

        assertEquals(1, result.size());
        assertEquals("kbdoc_size", result.get(0).metric());
    }
}
