// Responsibility: Verify admin usage/invite query validation and status derivation rules.
package com.notebook.learyAI.module.admin.application;

import com.notebook.learyAI.module.admin.domain.repository.AdminInviteReadRepository;
import com.notebook.learyAI.module.admin.domain.repository.AdminTaskDlqIncidentReadRepository;
import com.notebook.learyAI.module.admin.domain.repository.AdminUsageReadRepository;
import com.notebook.learyAI.module.admin.domain.repository.AdminUserReadRepository;
import com.notebook.learyAI.module.auth.application.PlatformAdminGuard;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.usage.application.service.UsageCurrentCycleQueryAppService;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AdminQueryAppServiceTest {
    @Mock
    private AdminUserReadRepository adminUserReadRepository;
    @Mock
    private AdminUsageReadRepository adminUsageReadRepository;
    @Mock
    private AdminInviteReadRepository adminInviteReadRepository;
    @Mock
    private AdminTaskDlqIncidentReadRepository adminTaskDlqIncidentReadRepository;
    @Mock
    private UsageCurrentCycleQueryAppService usageCurrentCycleQueryAppService;

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("listUsageEvents: metric 非白名单时应返回 USAGE-400")
    void listUsageEvents_invalidMetric_shouldThrowUsage400() {
        CurrentUserContext.set(1L, UserMode.ADMIN);
        AdminQueryAppService appService = new AdminQueryAppService(
                new PlatformAdminGuard(),
                adminUserReadRepository,
                adminUsageReadRepository,
                adminInviteReadRepository,
                adminTaskDlqIncidentReadRepository,
                usageCurrentCycleQueryAppService
        );

        BizException exception = assertThrows(BizException.class, () -> appService.listUsageEvents(
                null,
                null,
                null,
                "invalid_metric",
                null,
                null,
                0,
                20
        ));

        assertEquals("USAGE-400", exception.getCode());
    }

    @Test
    @DisplayName("getUsageSummary: 时间范围非法时应返回 USAGE-400")
    void getUsageSummary_invalidTimeRange_shouldThrowUsage400() {
        CurrentUserContext.set(1L, UserMode.ADMIN);
        AdminQueryAppService appService = new AdminQueryAppService(
                new PlatformAdminGuard(),
                adminUserReadRepository,
                adminUsageReadRepository,
                adminInviteReadRepository,
                adminTaskDlqIncidentReadRepository,
                usageCurrentCycleQueryAppService
        );

        BizException exception = assertThrows(BizException.class, () -> appService.getUsageSummary(
                null,
                Instant.parse("2026-06-20T10:00:00Z"),
                Instant.parse("2026-06-20T09:00:00Z"),
                null,
                null
        ));

        assertEquals("USAGE-400", exception.getCode());
    }

    @Test
    @DisplayName("listInvites: 应派生 ACTIVE、USED_UP、EXPIRED、REVOKED 状态")
    void listInvites_shouldResolveDerivedStatuses() {
        CurrentUserContext.set(1L, UserMode.ADMIN);
        AdminQueryAppService appService = new AdminQueryAppService(
                new PlatformAdminGuard(),
                adminUserReadRepository,
                adminUsageReadRepository,
                adminInviteReadRepository,
                adminTaskDlqIncidentReadRepository,
                usageCurrentCycleQueryAppService
        );
        Instant now = Instant.now();
        when(adminInviteReadRepository.findInvites(eq(null), any(), eq(null), any(), eq(0), eq(20)))
                .thenReturn(new AdminInviteReadRepository.InvitePageResult(4L, List.of(
                        new AdminInviteReadRepository.InviteRow(1L, UUID.randomUUID(), 1L, "ACTIVE", now.plusSeconds(3600), 3, 1, now, now),
                        new AdminInviteReadRepository.InviteRow(2L, UUID.randomUUID(), 1L, "ACTIVE", now.plusSeconds(3600), 2, 2, now, now),
                        new AdminInviteReadRepository.InviteRow(3L, UUID.randomUUID(), 1L, "ACTIVE", now.minusSeconds(3600), 3, 1, now, now),
                        new AdminInviteReadRepository.InviteRow(4L, UUID.randomUUID(), 1L, "REVOKED", now.plusSeconds(3600), 3, 0, now, now)
                )));

        AdminQueryAppService.InvitePageView page = appService.listInvites(null, null, null, 0, 20);

        assertEquals(List.of("ACTIVE", "USED_UP", "EXPIRED", "REVOKED"),
                page.items().stream().map(AdminQueryAppService.InviteItemView::status).toList());
    }

    @Test
    @DisplayName("getUserDetail: 返回指定用户详情")
    void getUserDetail_shouldReturnItem() {
        CurrentUserContext.set(1L, UserMode.ADMIN);
        AdminQueryAppService appService = new AdminQueryAppService(
                new PlatformAdminGuard(),
                adminUserReadRepository,
                adminUsageReadRepository,
                adminInviteReadRepository,
                adminTaskDlqIncidentReadRepository,
                usageCurrentCycleQueryAppService
        );
        Instant lastLoginAt = Instant.parse("2026-06-28T00:00:00Z");
        when(adminUserReadRepository.findByUserId(7L))
                .thenReturn(java.util.Optional.of(new AdminUserReadRepository.AdminUserLoginRow(
                        7L,
                        "测试用户",
                        "user@example.com",
                        null,
                        "MEMBER",
                        lastLoginAt
                )));

        AdminQueryAppService.UserRecentLoginItemView item = appService.getUserDetail(7L);

        assertEquals(7L, item.userId());
        assertEquals("user@example.com", item.email());
        assertEquals("MEMBER", item.userMode());
        verify(adminUserReadRepository).findByUserId(7L);
    }

    @Test
    @DisplayName("getUsageSummary: 显式 from/to 应优先于 windowType")
    void getUsageSummary_explicitTimeRangeShouldOverrideWindowType() {
        CurrentUserContext.set(1L, UserMode.ADMIN);
        AdminQueryAppService appService = new AdminQueryAppService(
                new PlatformAdminGuard(),
                adminUserReadRepository,
                adminUsageReadRepository,
                adminInviteReadRepository,
                adminTaskDlqIncidentReadRepository,
                usageCurrentCycleQueryAppService
        );
        Instant from = Instant.parse("2026-06-20T08:00:00Z");
        Instant to = Instant.parse("2026-06-20T09:00:00Z");
        when(adminUsageReadRepository.aggregateByMetric(from, to, null, null)).thenReturn(List.of());

        appService.getUsageSummary("last_24_hours", from, to, null, null);

        verify(adminUsageReadRepository).aggregateByMetric(from, to, null, null);
    }

    @Test
    @DisplayName("listUsageEvents: 显式 from/to 应优先于 windowType")
    void listUsageEvents_explicitTimeRangeShouldOverrideWindowType() {
        CurrentUserContext.set(1L, UserMode.ADMIN);
        AdminQueryAppService appService = new AdminQueryAppService(
                new PlatformAdminGuard(),
                adminUserReadRepository,
                adminUsageReadRepository,
                adminInviteReadRepository,
                adminTaskDlqIncidentReadRepository,
                usageCurrentCycleQueryAppService
        );
        Instant from = Instant.parse("2026-06-20T08:00:00Z");
        Instant to = Instant.parse("2026-06-20T09:00:00Z");
        when(adminUsageReadRepository.findEvents(from, to, "ai_chat_tokens", null, null, 0, 20))
                .thenReturn(new AdminUsageReadRepository.UsageEventPageResult(0L, List.of()));

        appService.listUsageEvents("last_24_hours", from, to, "ai_chat_tokens", null, null, 0, 20);

        verify(adminUsageReadRepository).findEvents(from, to, "ai_chat_tokens", null, null, 0, 20);
    }
}
