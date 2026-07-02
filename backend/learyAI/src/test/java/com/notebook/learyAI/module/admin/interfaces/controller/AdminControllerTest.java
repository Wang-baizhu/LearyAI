// Responsibility: Verify AdminController endpoint contract, validation, and delegation.
package com.notebook.learyAI.module.admin.interfaces.controller;

import com.notebook.learyAI.module.auth.application.RegisterInviteAdminAppService;
import com.notebook.learyAI.module.admin.application.AdminQueryAppService;
import com.notebook.learyAI.module.admin.application.AdminUserSubscriptionCycleAppService;
import com.notebook.learyAI.module.task.application.service.TaskDlqIncidentAdminAppService;
import com.notebook.learyAI.shared.exception.BizException;
import com.notebook.learyAI.shared.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AdminControllerTest {
    @Mock
    private AdminQueryAppService adminQueryAppService;
    @Mock
    private RegisterInviteAdminAppService registerInviteAdminAppService;
    @Mock
    private TaskDlqIncidentAdminAppService taskDlqIncidentAdminAppService;
    @Mock
    private AdminUserSubscriptionCycleAppService adminUserSubscriptionCycleAppService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AdminController controller = new AdminController(
                adminQueryAppService,
                adminUserSubscriptionCycleAppService,
                registerInviteAdminAppService,
                taskDlqIncidentAdminAppService
        );
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    @DisplayName("GET /api/admin/users/summary: 返回用户总数")
    void usersSummary_shouldReturnTotalUsers() throws Exception {
        when(adminQueryAppService.getUserSummary())
                .thenReturn(new AdminQueryAppService.UserSummaryView(128L));

        mockMvc.perform(get("/api/admin/users/summary"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.totalUsers").value(128));
    }

    @Test
    @DisplayName("GET /api/admin/users/recent-logins: 服务层校验失败返回 VALIDATION_ERROR")
    void recentLogins_invalidSize_shouldReturnValidationError() throws Exception {
        when(adminQueryAppService.listRecentLogins(0, 0))
                .thenThrow(new BizException("VALIDATION_ERROR", "size invalid"));

        mockMvc.perform(get("/api/admin/users/recent-logins").param("page", "0").param("size", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("GET /api/admin/users/{userId}: 返回用户详情")
    void userDetail_shouldReturnItem() throws Exception {
        Instant now = Instant.parse("2026-06-28T00:00:00Z");
        when(adminQueryAppService.getUserDetail(7L))
                .thenReturn(new AdminQueryAppService.UserRecentLoginItemView(
                        7L,
                        "测试用户",
                        "user@example.com",
                        null,
                        "MEMBER",
                        now
                ));

        mockMvc.perform(get("/api/admin/users/7"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(7))
                .andExpect(jsonPath("$.data.email").value("user@example.com"))
                .andExpect(jsonPath("$.data.userMode").value("MEMBER"));
    }

    @Test
    @DisplayName("GET /api/admin/users/{userId}/subscription-cycles: 返回会员周期列表")
    void userSubscriptionCycles_shouldReturnItems() throws Exception {
        Instant now = Instant.parse("2026-06-19T00:00:00Z");
        when(adminUserSubscriptionCycleAppService.listUserCycles(7L, "ai_chat_tokens"))
                .thenReturn(List.of(new AdminUserSubscriptionCycleAppService.SubscriptionCycleView(
                        1L, 7L, "ai_chat_tokens", "pro", 100L, now, now.plusSeconds(10), "ACTIVE", now, now
                )));

        mockMvc.perform(get("/api/admin/users/7/subscription-cycles").param("metric", "ai_chat_tokens"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].planId").value("pro"))
                .andExpect(jsonPath("$.data[0].quota").value(100));
    }

    @Test
    @DisplayName("PUT /api/admin/users/{userId}/subscription-cycles/{metric}: 返回更新结果")
    void updateUserSubscriptionCycle_shouldReturnItem() throws Exception {
        Instant now = Instant.parse("2026-06-19T00:00:00Z");
        when(adminUserSubscriptionCycleAppService.updateUserCycle(
                7L, "ai_chat_tokens", "pro", 100L, now, now.plusSeconds(3600)))
                .thenReturn(new AdminUserSubscriptionCycleAppService.SubscriptionCycleView(
                        2L, 7L, "ai_chat_tokens", "pro", 100L, now, now.plusSeconds(3600), "ACTIVE", now, now
                ));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put("/api/admin/users/7/subscription-cycles/ai_chat_tokens")
                        .contentType("application/json")
                        .content("""
                                {"planId":"pro","quota":100,"validFrom":"2026-06-19T00:00:00Z","validTo":"2026-06-19T01:00:00Z"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metric").value("ai_chat_tokens"))
                .andExpect(jsonPath("$.data.planId").value("pro"));
    }

    @Test
    @DisplayName("GET /api/admin/usage/summary: 参数透传并返回汇总")
    void usageSummary_shouldDelegateAndReturn() throws Exception {
        when(adminQueryAppService.getUsageSummary("last_24_hours", null, null, null, null))
                .thenReturn(List.of(new AdminQueryAppService.UsageMetricSummaryView("kbdoc_size", 12L, 0L, -1L, -1L)));

        mockMvc.perform(get("/api/admin/usage/summary").param("windowType", "last_24_hours"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data[0].metric").value("kbdoc_size"))
                .andExpect(jsonPath("$.data[0].used").value(12));

        verify(adminQueryAppService).getUsageSummary("last_24_hours", null, null, null, null);
    }

    @Test
    @DisplayName("GET /api/admin/usage/event/list: windowType 非法返回 USAGE-400")
    void usageEventList_invalidWindowType_shouldReturnUsage400() throws Exception {
        when(adminQueryAppService.listUsageEvents("invalid", null, null, null, null, null, 0, 20))
                .thenThrow(new BizException("USAGE-400", "windowType invalid"));

        mockMvc.perform(get("/api/admin/usage/event/list")
                        .param("windowType", "invalid")
                        .param("page", "0")
                        .param("size", "20"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("USAGE-400"));
    }

    @Test
    @DisplayName("GET /api/admin/usage/current-cycle: 返回指定用户当前周期额度")
    void usageCurrentCycle_shouldReturnItem() throws Exception {
        Instant now = Instant.parse("2026-06-19T00:00:00Z");
        when(adminQueryAppService.getCurrentCycleUsage(7L, "project-1", "ai_chat_tokens"))
                .thenReturn(new AdminQueryAppService.CurrentCycleUsageView(
                        7L, "project-1", "ai_chat_tokens", 11L, 20L, 3L, 100L, 77L, now, now.plusSeconds(3600), now
                ));

        mockMvc.perform(get("/api/admin/usage/current-cycle")
                        .param("userId", "7")
                        .param("projectId", "project-1")
                        .param("metric", "ai_chat_tokens"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.metric").value("ai_chat_tokens"))
                .andExpect(jsonPath("$.data.available").value(77))
                .andExpect(jsonPath("$.data.reserved").value(3));
    }

    @Test
    @DisplayName("GET /api/admin/invites: 返回邀请码分页")
    void invites_shouldReturnInvitePage() throws Exception {
        AdminQueryAppService.InviteItemView item = new AdminQueryAppService.InviteItemView(
                1L,
                "550e8400-e29b-41d4-a716-446655440000",
                9L,
                "ACTIVE",
                Instant.parse("2026-03-31T00:00:00Z"),
                null,
                3,
                1,
                Instant.parse("2026-03-01T00:00:00Z"),
                Instant.parse("2026-03-01T00:00:00Z")
        );
        when(adminQueryAppService.listInvites(null, null, null, 0, 20))
                .thenReturn(new AdminQueryAppService.InvitePageView(0, 20, 1L, List.of(item)));

        mockMvc.perform(get("/api/admin/invites"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].inviteId").value(1))
                .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"));
    }

    @Test
    @DisplayName("GET /api/admin/invites/{inviteId}: 不存在返回 INVITE-404")
    void inviteDetail_notFound_shouldReturnInvite404() throws Exception {
        when(adminQueryAppService.getInviteDetail("404"))
                .thenThrow(new BizException("INVITE-404", "invite not found"));

        mockMvc.perform(get("/api/admin/invites/404"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVITE-404"));
    }

    @Test
    @DisplayName("GET /api/admin/register-invites: 返回注册邀请码分页")
    void registerInvites_shouldReturnInvitePage() throws Exception {
        RegisterInviteAdminAppService.RegisterInviteItemView item = new RegisterInviteAdminAppService.RegisterInviteItemView(
                11L,
                "INVITE-001",
                "ACTIVE",
                1L,
                null,
                null,
                Instant.parse("2026-06-10T00:00:00Z"),
                Instant.parse("2026-06-10T00:00:00Z")
        );
        when(registerInviteAdminAppService.listInvites(null, 0, 20))
                .thenReturn(new RegisterInviteAdminAppService.RegisterInvitePageView(0, 20, 1L, List.of(item)));

        mockMvc.perform(get("/api/admin/register-invites"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].inviteId").value(11))
                .andExpect(jsonPath("$.data.items[0].code").value("INVITE-001"));
    }

    @Test
    @DisplayName("GET /api/admin/task-dlq-incidents: 返回 DLQ 记录分页")
    void taskDlqIncidents_shouldReturnPage() throws Exception {
        AdminQueryAppService.TaskDlqIncidentItemView item = new AdminQueryAppService.TaskDlqIncidentItemView(
                21L,
                "msg-21",
                "task.agent.run.dlq",
                "task.command.agent.run.dlq",
                "COMMAND",
                101L,
                100L,
                "project-1",
                "kb-1",
                "stage-1",
                "agent",
                "{\"a\":1}",
                "boom",
                3,
                "OPEN",
                null,
                Instant.parse("2026-06-10T00:00:00Z"),
                Instant.parse("2026-06-10T00:00:00Z")
        );
        when(adminQueryAppService.listTaskDlqIncidents(null, null, 0, 20))
                .thenReturn(new AdminQueryAppService.TaskDlqIncidentPageView(0, 20, 1L, List.of(item)));

        mockMvc.perform(get("/api/admin/task-dlq-incidents"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].incidentId").value(21))
                .andExpect(jsonPath("$.data.items[0].errorMessage").value("boom"));
    }

    @Test
    @DisplayName("POST /api/admin/register-invites: 返回创建结果")
    void createRegisterInvite_shouldReturnCreatedInvite() throws Exception {
        RegisterInviteAdminAppService.RegisterInviteItemView item = new RegisterInviteAdminAppService.RegisterInviteItemView(
                12L,
                "INVITE-002",
                "ACTIVE",
                1L,
                null,
                null,
                Instant.parse("2026-06-10T00:00:00Z"),
                Instant.parse("2026-06-10T00:00:00Z")
        );
        when(registerInviteAdminAppService.createInvites("INVITE-002", 1)).thenReturn(List.of(item));

        mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/admin/register-invites")
                        .contentType("application/json")
                        .content("{\"code\":\"INVITE-002\",\"count\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data[0].code").value("INVITE-002"));
    }
}
