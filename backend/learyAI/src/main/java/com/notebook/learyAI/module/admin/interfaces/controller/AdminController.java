// Responsibility: Expose admin business-statistics endpoints with unified platform-admin authorization.
package com.notebook.learyAI.module.admin.interfaces.controller;

import com.notebook.learyAI.module.auth.application.RegisterInviteAdminAppService;
import com.notebook.learyAI.module.admin.application.AdminQueryAppService;
import com.notebook.learyAI.module.admin.application.AdminUserSubscriptionCycleAppService;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminInviteDetailResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminInviteItemResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminInvitePageResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminRegisterInviteCreateRequest;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminRegisterInviteDetailResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminRegisterInviteItemResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminRegisterInvitePageResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminTaskDlqIncidentItemResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminTaskDlqIncidentPageResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminTaskDlqIncidentStatusUpdateRequest;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUsageCurrentCycleResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUsageEventListItemResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUsageEventPageResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUsageMetricSummaryResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUserRecentLoginItemResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUserRecentLoginPageResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUserSubscriptionCycleResponse;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUserSubscriptionCycleUpsertRequest;
import com.notebook.learyAI.module.admin.interfaces.dto.AdminUserSummaryResponse;
import com.notebook.learyAI.module.task.application.service.TaskDlqIncidentAdminAppService;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import com.notebook.learyAI.shared.api.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

@Validated
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminQueryAppService adminQueryAppService;
    private final AdminUserSubscriptionCycleAppService adminUserSubscriptionCycleAppService;
    private final RegisterInviteAdminAppService registerInviteAdminAppService;
    private final TaskDlqIncidentAdminAppService taskDlqIncidentAdminAppService;

    public AdminController(AdminQueryAppService adminQueryAppService,
                           AdminUserSubscriptionCycleAppService adminUserSubscriptionCycleAppService,
                           RegisterInviteAdminAppService registerInviteAdminAppService,
                           TaskDlqIncidentAdminAppService taskDlqIncidentAdminAppService) {
        this.adminQueryAppService = adminQueryAppService;
        this.adminUserSubscriptionCycleAppService = adminUserSubscriptionCycleAppService;
        this.registerInviteAdminAppService = registerInviteAdminAppService;
        this.taskDlqIncidentAdminAppService = taskDlqIncidentAdminAppService;
    }

    @GetMapping("/users/summary")
    public ApiResponse<AdminUserSummaryResponse> userSummary() {
        AdminQueryAppService.UserSummaryView view = adminQueryAppService.getUserSummary();
        return ApiResponse.ok("用户统计查询成功", new AdminUserSummaryResponse(view.totalUsers()));
    }

    @GetMapping("/users/recent-logins")
    public ApiResponse<AdminUserRecentLoginPageResponse> recentLogins(
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        AdminQueryAppService.UserRecentLoginPageView view = adminQueryAppService.listRecentLogins(page, size);
        List<AdminUserRecentLoginItemResponse> items = view.items().stream()
                .map(item -> new AdminUserRecentLoginItemResponse(
                        item.userId(),
                        item.name(),
                        item.email(),
                        item.phone(),
                        item.userMode(),
                        item.lastLoginAt()
                ))
                .toList();
        return ApiResponse.ok("最近登录用户查询成功",
                new AdminUserRecentLoginPageResponse(view.page(), view.size(), view.total(), items));
    }

    @GetMapping("/users/{userId}")
    public ApiResponse<AdminUserRecentLoginItemResponse> userDetail(@PathVariable @Positive Long userId) {
        AdminQueryAppService.UserRecentLoginItemView view = adminQueryAppService.getUserDetail(userId);
        return ApiResponse.ok("用户详情查询成功", new AdminUserRecentLoginItemResponse(
                view.userId(),
                view.name(),
                view.email(),
                view.phone(),
                view.userMode(),
                view.lastLoginAt()
        ));
    }

    @GetMapping("/users/{userId}/subscription-cycles")
    public ApiResponse<List<AdminUserSubscriptionCycleResponse>> userSubscriptionCycles(
            @PathVariable @Positive Long userId,
            @RequestParam(required = false) String metric) {
        List<AdminUserSubscriptionCycleResponse> items = adminUserSubscriptionCycleAppService
                .listUserCycles(userId, metric)
                .stream()
                .map(item -> new AdminUserSubscriptionCycleResponse(
                        item.id(),
                        item.userId(),
                        item.metric(),
                        item.planId(),
                        item.quota(),
                        item.validFrom(),
                        item.validTo(),
                        item.status(),
                        item.createdAt(),
                        item.updatedAt()
                ))
                .toList();
        return ApiResponse.ok("用户会员周期查询成功", items);
    }

    @PutMapping("/users/{userId}/subscription-cycles/{metric}")
    public ApiResponse<AdminUserSubscriptionCycleResponse> updateUserSubscriptionCycle(
            @PathVariable @Positive Long userId,
            @PathVariable @NotBlank String metric,
            @Valid @RequestBody AdminUserSubscriptionCycleUpsertRequest request) {
        AdminUserSubscriptionCycleAppService.SubscriptionCycleView item = adminUserSubscriptionCycleAppService
                .updateUserCycle(userId, metric, request.getPlanId(), request.getQuota(), request.getValidFrom(), request.getValidTo());
        return ApiResponse.ok("用户会员周期更新成功", new AdminUserSubscriptionCycleResponse(
                item.id(),
                item.userId(),
                item.metric(),
                item.planId(),
                item.quota(),
                item.validFrom(),
                item.validTo(),
                item.status(),
                item.createdAt(),
                item.updatedAt()
        ));
    }

    @GetMapping("/usage/summary")
    public ApiResponse<List<AdminUsageMetricSummaryResponse>> usageSummary(
            @RequestParam(required = false) String windowType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) @Positive Long userId,
            @RequestParam(required = false) String projectId) {
        List<AdminUsageMetricSummaryResponse> items = adminQueryAppService
                .getUsageSummary(windowType, from, to, userId, projectId)
                .stream()
                .map(item -> new AdminUsageMetricSummaryResponse(
                        item.metric(),
                        item.used(),
                        item.reserved(),
                        item.quota(),
                        item.available()
                ))
                .toList();
        return ApiResponse.ok("用量汇总查询成功", items);
    }

    @GetMapping("/usage/event/list")
    public ApiResponse<AdminUsageEventPageResponse> usageEventList(
            @RequestParam(required = false) String windowType,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(required = false) String metric,
            @RequestParam(required = false) @Positive Long userId,
            @RequestParam(required = false) String projectId,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        AdminQueryAppService.UsageEventPageView view = adminQueryAppService
                .listUsageEvents(windowType, from, to, metric, userId, projectId, page, size);
        List<AdminUsageEventListItemResponse> items = view.items().stream()
                .map(item -> new AdminUsageEventListItemResponse(
                        item.userId(),
                        item.projectId(),
                        item.metric(),
                        item.delta(),
                        item.idempotencyKey(),
                        item.sourceType(),
                        item.sourceId(),
                        item.occurredAt(),
                        item.createdAt()
                ))
                .toList();
        return ApiResponse.ok("用量明细查询成功",
                new AdminUsageEventPageResponse(view.page(), view.size(), view.total(), items));
    }

    @GetMapping("/usage/current-cycle")
    public ApiResponse<AdminUsageCurrentCycleResponse> usageCurrentCycle(
            @RequestParam @Positive Long userId,
            @RequestParam @NotBlank String projectId,
            @RequestParam @NotBlank String metric) {
        AdminQueryAppService.CurrentCycleUsageView view = adminQueryAppService.getCurrentCycleUsage(userId, projectId, metric);
        return ApiResponse.ok("当前周期额度查询成功", new AdminUsageCurrentCycleResponse(
                view.userId(),
                view.projectId(),
                view.metric(),
                view.cycleId(),
                view.used(),
                view.reserved(),
                view.quota(),
                view.available(),
                view.validFrom(),
                view.validTo(),
                view.updatedAt()
        ));
    }

    @GetMapping("/invites")
    public ApiResponse<AdminInvitePageResponse> inviteList(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String projectId,
            @RequestParam(required = false) @Positive Long creatorUserId,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        AdminQueryAppService.InvitePageView view = adminQueryAppService
                .listInvites(status, projectId, creatorUserId, page, size);
        List<AdminInviteItemResponse> items = view.items().stream()
                .map(item -> new AdminInviteItemResponse(
                        item.inviteId(),
                        item.projectId(),
                        item.creatorUserId(),
                        item.status(),
                        item.expiresAt(),
                        item.revokedAt(),
                        item.maxUses(),
                        item.usedCount(),
                        item.createdAt(),
                        item.updatedAt()
                ))
                .toList();
        return ApiResponse.ok("邀请码列表查询成功", new AdminInvitePageResponse(view.page(), view.size(), view.total(), items));
    }

    @GetMapping("/invites/{inviteId}")
    public ApiResponse<AdminInviteDetailResponse> inviteDetail(@PathVariable String inviteId) {
        AdminQueryAppService.InviteItemView item = adminQueryAppService.getInviteDetail(inviteId);
        return ApiResponse.ok("邀请码详情查询成功", new AdminInviteDetailResponse(
                item.inviteId(),
                item.projectId(),
                item.creatorUserId(),
                item.status(),
                item.expiresAt(),
                item.revokedAt(),
                item.maxUses(),
                item.usedCount(),
                item.createdAt(),
                item.updatedAt()
        ));
    }

    @GetMapping("/register-invites")
    public ApiResponse<AdminRegisterInvitePageResponse> registerInviteList(
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        RegisterInviteAdminAppService.RegisterInvitePageView view = registerInviteAdminAppService
                .listInvites(status, page, size);
        List<AdminRegisterInviteItemResponse> items = view.items().stream()
                .map(item -> new AdminRegisterInviteItemResponse(
                        item.inviteId(),
                        item.code(),
                        item.status(),
                        item.createdBy(),
                        item.usedByUserId(),
                        item.usedAt(),
                        item.createdAt(),
                        item.updatedAt()
                ))
                .toList();
        return ApiResponse.ok("注册邀请码列表查询成功",
                new AdminRegisterInvitePageResponse(view.page(), view.size(), view.total(), items));
    }

    @GetMapping("/register-invites/{inviteId}")
    public ApiResponse<AdminRegisterInviteDetailResponse> registerInviteDetail(@PathVariable String inviteId) {
        RegisterInviteAdminAppService.RegisterInviteItemView item = registerInviteAdminAppService.getInviteDetail(inviteId);
        return ApiResponse.ok("注册邀请码详情查询成功",
                new AdminRegisterInviteDetailResponse(
                        item.inviteId(),
                        item.code(),
                        item.status(),
                        item.createdBy(),
                        item.usedByUserId(),
                        item.usedAt(),
                        item.createdAt(),
                        item.updatedAt()
                ));
    }

    @PostMapping("/register-invites")
    public ApiResponse<List<AdminRegisterInviteDetailResponse>> createRegisterInvite(
            @Valid @RequestBody AdminRegisterInviteCreateRequest request) {
        List<AdminRegisterInviteDetailResponse> items = registerInviteAdminAppService
                .createInvites(request.getCode(), request.getCount())
                .stream()
                .map(item -> new AdminRegisterInviteDetailResponse(
                        item.inviteId(),
                        item.code(),
                        item.status(),
                        item.createdBy(),
                        item.usedByUserId(),
                        item.usedAt(),
                        item.createdAt(),
                        item.updatedAt()
                ))
                .toList();
        return ApiResponse.ok("注册邀请码创建成功", items);
    }

    @PutMapping("/register-invites/{inviteId}:inactive")
    public ApiResponse<AdminRegisterInviteDetailResponse> deactivateRegisterInvite(@PathVariable String inviteId) {
        RegisterInviteAdminAppService.RegisterInviteItemView item = registerInviteAdminAppService.deactivateInvite(inviteId);
        return ApiResponse.ok("注册邀请码已停用",
                new AdminRegisterInviteDetailResponse(
                        item.inviteId(),
                        item.code(),
                        item.status(),
                        item.createdBy(),
                        item.usedByUserId(),
                        item.usedAt(),
                        item.createdAt(),
                        item.updatedAt()
                ));
    }

    @DeleteMapping("/register-invites/{inviteId}")
    public ApiResponse<Void> deleteRegisterInvite(@PathVariable String inviteId) {
        registerInviteAdminAppService.deleteInvite(inviteId);
        return ApiResponse.ok("注册邀请码删除成功", null);
    }

    @GetMapping("/task-dlq-incidents")
    public ApiResponse<AdminTaskDlqIncidentPageResponse> taskDlqIncidentList(
            @RequestParam(required = false) String incidentStatus,
            @RequestParam(required = false) String dlqType,
            @RequestParam(defaultValue = "0") @Min(0) Integer page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) Integer size) {
        AdminQueryAppService.TaskDlqIncidentPageView view = adminQueryAppService
                .listTaskDlqIncidents(incidentStatus, dlqType, page, size);
        List<AdminTaskDlqIncidentItemResponse> items = view.items().stream()
                .map(this::toTaskDlqIncidentItemResponse)
                .toList();
        return ApiResponse.ok("任务 DLQ 记录查询成功",
                new AdminTaskDlqIncidentPageResponse(view.page(), view.size(), view.total(), items));
    }

    @PutMapping("/task-dlq-incidents/{incidentId}/status")
    public ApiResponse<AdminTaskDlqIncidentItemResponse> updateTaskDlqIncidentStatus(
            @PathVariable @Positive Long incidentId,
            @Valid @RequestBody AdminTaskDlqIncidentStatusUpdateRequest request) {
        TaskDlqIncident incident = taskDlqIncidentAdminAppService.updateStatus(incidentId, request.getIncidentStatus());
        return ApiResponse.ok("任务 DLQ 记录状态更新成功", toTaskDlqIncidentItemResponse(incident));
    }

    @DeleteMapping("/task-dlq-incidents/{incidentId}")
    public ApiResponse<Void> deleteTaskDlqIncident(@PathVariable @Positive Long incidentId) {
        taskDlqIncidentAdminAppService.delete(incidentId);
        return ApiResponse.ok("任务 DLQ 记录删除成功", null);
    }

    private AdminTaskDlqIncidentItemResponse toTaskDlqIncidentItemResponse(AdminQueryAppService.TaskDlqIncidentItemView item) {
        return new AdminTaskDlqIncidentItemResponse(
                item.incidentId(),
                item.messageId(),
                item.sourceQueue(),
                item.sourceRoutingKey(),
                item.dlqType(),
                item.taskRecordId(),
                item.parentTaskRecordId(),
                item.projectId(),
                item.kbId(),
                item.stageRunKey(),
                item.taskType(),
                item.payloadJson(),
                item.errorMessage(),
                item.retryCount(),
                item.incidentStatus(),
                item.compensationAction(),
                item.createdAt(),
                item.updatedAt()
        );
    }

    private AdminTaskDlqIncidentItemResponse toTaskDlqIncidentItemResponse(TaskDlqIncident item) {
        return new AdminTaskDlqIncidentItemResponse(
                item.getId(),
                item.getMessageId(),
                item.getSourceQueue(),
                item.getSourceRoutingKey(),
                item.getDlqType(),
                item.getTaskRecordId(),
                item.getParentTaskRecordId(),
                item.getProjectId(),
                item.getKbId(),
                item.getStageRunKey(),
                item.getTaskType(),
                item.getPayloadJson(),
                item.getErrorMessage(),
                item.getRetryCount(),
                item.getIncidentStatus(),
                item.getCompensationAction(),
                item.getCreatedAt(),
                item.getUpdatedAt()
        );
    }

}
