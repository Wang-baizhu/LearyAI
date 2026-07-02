// Responsibility: Provide admin-only business event statistics queries for users, usage snapshots, and invites.
package com.notebook.learyAI.module.admin.application;

import com.notebook.learyAI.module.admin.domain.repository.AdminTaskDlqIncidentReadRepository;
import com.notebook.learyAI.module.auth.application.PlatformAdminGuard;
import com.notebook.learyAI.module.admin.domain.repository.AdminInviteReadRepository;
import com.notebook.learyAI.module.admin.domain.repository.AdminUsageReadRepository;
import com.notebook.learyAI.module.admin.domain.repository.AdminUserReadRepository;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import com.notebook.learyAI.module.usage.application.service.UsageCurrentCycleQueryAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
public class AdminQueryAppService {
    private static final Set<String> USAGE_METRICS = Set.of(
            "task_tokens_input_other",
            "task_tokens_output",
            "task_tokens_cache_read",
            "task_tokens_cache_creation",
            "ai_chat_tokens",
            "kbdoc_size"
    );

    private static final Set<String> INVITE_STATUS = Set.of("ACTIVE", "USED_UP", "EXPIRED", "REVOKED");
    private static final Set<String> TASK_DLQ_INCIDENT_STATUS = Set.of(
            TaskDlqIncident.STATUS_OPEN,
            TaskDlqIncident.STATUS_COMPENSATED,
            TaskDlqIncident.STATUS_RESOLVED,
            TaskDlqIncident.STATUS_IGNORED
    );
    private static final Set<String> TASK_DLQ_TYPES = Set.of("COMMAND", "STATUS");

    private final PlatformAdminGuard platformAdminGuard;
    private final AdminUserReadRepository adminUserReadRepository;
    private final AdminUsageReadRepository adminUsageReadRepository;
    private final AdminInviteReadRepository adminInviteReadRepository;
    private final AdminTaskDlqIncidentReadRepository adminTaskDlqIncidentReadRepository;
    private final UsageCurrentCycleQueryAppService usageCurrentCycleQueryAppService;

    public AdminQueryAppService(PlatformAdminGuard platformAdminGuard,
                                AdminUserReadRepository adminUserReadRepository,
                                AdminUsageReadRepository adminUsageReadRepository,
                                AdminInviteReadRepository adminInviteReadRepository,
                                AdminTaskDlqIncidentReadRepository adminTaskDlqIncidentReadRepository,
                                UsageCurrentCycleQueryAppService usageCurrentCycleQueryAppService) {
        this.platformAdminGuard = platformAdminGuard;
        this.adminUserReadRepository = adminUserReadRepository;
        this.adminUsageReadRepository = adminUsageReadRepository;
        this.adminInviteReadRepository = adminInviteReadRepository;
        this.adminTaskDlqIncidentReadRepository = adminTaskDlqIncidentReadRepository;
        this.usageCurrentCycleQueryAppService = usageCurrentCycleQueryAppService;
    }

    public UserSummaryView getUserSummary() {
        platformAdminGuard.requireAdmin();
        return new UserSummaryView(adminUserReadRepository.countAllUsers());
    }

    public UserRecentLoginPageView listRecentLogins(int page, int size) {
        platformAdminGuard.requireAdmin();
        validatePaging(page, size);
        long total = adminUserReadRepository.countAllUsers();
        List<UserRecentLoginItemView> items = adminUserReadRepository.listRecentLogins(page, size).stream()
                .map(user -> new UserRecentLoginItemView(
                        user.userId(),
                        user.name(),
                        user.email(),
                        user.phone(),
                        user.userMode(),
                        user.lastLoginAt()
                ))
                .toList();
        return new UserRecentLoginPageView(page, size, total, items);
    }

    public UserRecentLoginItemView getUserDetail(long userId) {
        platformAdminGuard.requireAdmin();
        validateUserId(userId);
        AdminUserReadRepository.AdminUserLoginRow user = adminUserReadRepository.findByUserId(userId)
                .orElseThrow(() -> new BizException("USER-404", "user not found"));
        return new UserRecentLoginItemView(
                user.userId(),
                user.name(),
                user.email(),
                user.phone(),
                user.userMode(),
                user.lastLoginAt()
        );
    }

    public List<UsageMetricSummaryView> getUsageSummary(String windowType,
                                                        Instant from,
                                                        Instant to,
                                                        Long userId,
                                                        String projectId) {
        platformAdminGuard.requireAdmin();
        UsageTimeRange usageTimeRange = resolveUsageTimeRange(windowType, from, to);
        Instant normalizedFrom = usageTimeRange.from();
        Instant normalizedTo = usageTimeRange.to();
        validateTimeRange(normalizedFrom, normalizedTo);
        validateUserId(userId);
        String normalizedProjectId = normalizeProjectId(projectId);

        return adminUsageReadRepository.aggregateByMetric(
                        normalizedFrom,
                        normalizedTo,
                        userId,
                        normalizedProjectId
                ).stream()
                .filter(item -> USAGE_METRICS.contains(item.metric()))
                .map(item -> {
                    long used = safeLong(item.used());
                    long quota = safeLong(item.quota());
                    long available = quota < 0 ? -1 : Math.max(0, quota - used);
                    return new UsageMetricSummaryView(item.metric(), used, 0L, quota, available);
                })
                .sorted(java.util.Comparator.comparing(UsageMetricSummaryView::metric))
                .toList();
    }

    public UsageEventPageView listUsageEvents(String windowType,
                                              Instant from,
                                              Instant to,
                                              String metric,
                                              Long userId,
                                              String projectId,
                                              int page,
                                              int size) {
        platformAdminGuard.requireAdmin();
        validatePaging(page, size);
        UsageTimeRange usageTimeRange = resolveUsageTimeRange(windowType, from, to);
        Instant normalizedFrom = usageTimeRange.from();
        Instant normalizedTo = usageTimeRange.to();
        validateTimeRange(normalizedFrom, normalizedTo);
        validateUserId(userId);
        String normalizedProjectId = normalizeProjectId(projectId);
        String normalizedMetric = normalizeMetric(metric);

        AdminUsageReadRepository.UsageEventPageResult result = adminUsageReadRepository.findEvents(
                normalizedFrom,
                normalizedTo,
                normalizedMetric,
                userId,
                normalizedProjectId,
                page,
                size
        );

        List<UsageEventItemView> items = result.items().stream().map(this::toUsageEventItem).toList();
        return new UsageEventPageView(page, size, result.total(), items);
    }

    public CurrentCycleUsageView getCurrentCycleUsage(long userId, String projectId, String metric) {
        platformAdminGuard.requireAdmin();
        validateUserId(userId);
        String normalizedProjectId = normalizeRequiredProjectId(projectId);
        String normalizedMetric = normalizeRequiredMetric(metric);
        CurrentCycleUsage usage = usageCurrentCycleQueryAppService.getUserCycle(userId, normalizedProjectId, normalizedMetric);
        return new CurrentCycleUsageView(
                usage.userId(),
                usage.projectId(),
                usage.metric(),
                usage.cycleId(),
                usage.used(),
                usage.reserved(),
                usage.quota(),
                usage.available(),
                usage.validFrom(),
                usage.validTo(),
                usage.updatedAt()
        );
    }

    public InvitePageView listInvites(String status,
                                      String projectId,
                                      Long creatorUserId,
                                      int page,
                                      int size) {
        platformAdminGuard.requireAdmin();
        validatePaging(page, size);
        validateUserId(creatorUserId);
        String normalizedStatus = normalizeInviteStatus(status);
        UUID projectUuid = normalizeProjectUuid(projectId);

        AdminInviteReadRepository.InvitePageResult result = adminInviteReadRepository.findInvites(
                normalizedStatus,
                projectUuid,
                creatorUserId,
                Instant.now(),
                page,
                size
        );

        List<InviteItemView> items = result.items().stream().map(this::toInviteItem).toList();
        return new InvitePageView(page, size, result.total(), items);
    }

    public InviteItemView getInviteDetail(String inviteId) {
        platformAdminGuard.requireAdmin();
        long normalizedInviteId = parseInviteId(inviteId);
        AdminInviteReadRepository.InviteRow invite = adminInviteReadRepository.findById(normalizedInviteId)
                .orElseThrow(() -> new BizException("INVITE-404", "invite not found"));
        return toInviteItem(invite);
    }

    public TaskDlqIncidentPageView listTaskDlqIncidents(String incidentStatus,
                                                        String dlqType,
                                                        int page,
                                                        int size) {
        platformAdminGuard.requireAdmin();
        validatePaging(page, size);
        String normalizedIncidentStatus = normalizeTaskDlqIncidentStatus(incidentStatus);
        String normalizedDlqType = normalizeTaskDlqType(dlqType);
        AdminTaskDlqIncidentReadRepository.TaskDlqIncidentPageResult result = adminTaskDlqIncidentReadRepository.findIncidents(
                normalizedIncidentStatus,
                normalizedDlqType,
                page,
                size
        );
        List<TaskDlqIncidentItemView> items = result.items().stream()
                .map(this::toTaskDlqIncidentItem)
                .toList();
        return new TaskDlqIncidentPageView(page, size, result.total(), items);
    }

    private UsageEventItemView toUsageEventItem(AdminUsageReadRepository.UsageEventRow row) {
        return new UsageEventItemView(
                row.userId(),
                row.projectId(),
                row.metric(),
                row.delta(),
                row.idempotencyKey(),
                row.sourceType(),
                row.sourceId(),
                row.occurredAt(),
                row.createdAt()
        );
    }

    private InviteItemView toInviteItem(AdminInviteReadRepository.InviteRow row) {
        String resolvedStatus = resolveInviteStatus(row, Instant.now());
        Instant revokedAt = "REVOKED".equals(resolvedStatus) ? row.updatedAt() : null;
        return new InviteItemView(
                row.inviteId(),
                row.projectId() == null ? null : row.projectId().toString(),
                row.creatorUserId(),
                resolvedStatus,
                row.expiresAt(),
                revokedAt,
                row.maxUse(),
                row.usedCount(),
                row.createdAt(),
                row.updatedAt()
        );
    }

    private TaskDlqIncidentItemView toTaskDlqIncidentItem(AdminTaskDlqIncidentReadRepository.TaskDlqIncidentRow row) {
        return new TaskDlqIncidentItemView(
                row.incidentId(),
                row.messageId(),
                row.sourceQueue(),
                row.sourceRoutingKey(),
                row.dlqType(),
                row.taskRecordId(),
                row.parentTaskRecordId(),
                row.projectId(),
                row.kbId(),
                row.stageRunKey(),
                row.taskType(),
                row.payloadJson(),
                row.errorMessage(),
                row.retryCount(),
                row.incidentStatus(),
                row.compensationAction(),
                row.createdAt(),
                row.updatedAt()
        );
    }

    private String resolveInviteStatus(AdminInviteReadRepository.InviteRow row, Instant now) {
        if ("REVOKED".equals(row.status())) {
            return "REVOKED";
        }
        if ("EXPIRED".equals(row.status())) {
            return "EXPIRED";
        }
        if (row.expiresAt() != null && row.expiresAt().isBefore(now)) {
            return "EXPIRED";
        }
        if (row.usedCount() >= row.maxUse()) {
            return "USED_UP";
        }
        return "ACTIVE";
    }

    private String normalizeMetric(String metric) {
        if (metric == null || metric.isBlank()) {
            return null;
        }
        String normalized = metric.trim();
        if (!USAGE_METRICS.contains(normalized)) {
            throw new BizException("USAGE-400", "metric invalid");
        }
        return normalized;
    }

    private String normalizeRequiredMetric(String metric) {
        String normalized = normalizeMetric(metric);
        if (normalized == null) {
            throw new BizException("USAGE-400", "metric required");
        }
        return normalized;
    }

    private String normalizeInviteStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        String normalized = status.trim().toUpperCase();
        if (!INVITE_STATUS.contains(normalized)) {
            throw new BizException("VALIDATION_ERROR", "status invalid");
        }
        return normalized;
    }

    private String normalizeTaskDlqIncidentStatus(String incidentStatus) {
        if (incidentStatus == null || incidentStatus.isBlank()) {
            return null;
        }
        String normalized = incidentStatus.trim().toUpperCase();
        if (!TASK_DLQ_INCIDENT_STATUS.contains(normalized)) {
            throw new BizException("VALIDATION_ERROR", "incidentStatus invalid");
        }
        return normalized;
    }

    private String normalizeTaskDlqType(String dlqType) {
        if (dlqType == null || dlqType.isBlank()) {
            return null;
        }
        String normalized = dlqType.trim().toUpperCase();
        if (!TASK_DLQ_TYPES.contains(normalized)) {
            throw new BizException("VALIDATION_ERROR", "dlqType invalid");
        }
        return normalized;
    }

    private UUID normalizeProjectUuid(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(projectId.trim());
        } catch (IllegalArgumentException ex) {
            throw new BizException("VALIDATION_ERROR", "projectId invalid");
        }
    }

    private String normalizeProjectId(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return null;
        }
        return projectId.trim();
    }

    private String normalizeRequiredProjectId(String projectId) {
        String normalized = normalizeProjectId(projectId);
        if (normalized == null) {
            throw new BizException("USAGE-400", "projectId required");
        }
        return normalized;
    }

    private Instant normalizeInstant(Instant input) {
        return input;
    }

    private void validateTimeRange(Instant from, Instant to) {
        if (from != null && to != null && from.isAfter(to)) {
            throw new BizException("USAGE-400", "time range invalid");
        }
    }

    private void validateUserId(Long userId) {
        if (userId != null && userId <= 0) {
            throw new BizException("VALIDATION_ERROR", "userId invalid");
        }
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
        if (page < 0) {
            throw new BizException("VALIDATION_ERROR", "page invalid");
        }
        if (size < 1 || size > 100) {
            throw new BizException("VALIDATION_ERROR", "size invalid");
        }
    }

    private long safeLong(Long value) {
        return value == null ? 0L : value;
    }

    private UsageTimeRange resolveUsageTimeRange(String windowType, Instant from, Instant to) {
        if (from != null || to != null) {
            return new UsageTimeRange(normalizeInstant(from), normalizeInstant(to));
        }
        if (windowType == null || windowType.isBlank()) {
            return new UsageTimeRange(normalizeInstant(from), normalizeInstant(to));
        }
        UsageWindowType type = UsageWindowType.fromWireValue(windowType);
        Instant now = Instant.now();
        Instant resolvedFrom = type == UsageWindowType.LAST_24_HOURS
                ? now.minusSeconds(24 * 3600L)
                : now.minusSeconds(30L * 24L * 3600L);
        return new UsageTimeRange(resolvedFrom, now);
    }

    public record UserSummaryView(long totalUsers) {
    }

    public record UserRecentLoginItemView(long userId,
                                          String name,
                                          String email,
                                          String phone,
                                          String userMode,
                                          Instant lastLoginAt) {
    }

    public record UserRecentLoginPageView(int page,
                                          int size,
                                          long total,
                                          List<UserRecentLoginItemView> items) {
    }

    private record UsageTimeRange(Instant from, Instant to) {
    }

    public record UsageMetricSummaryView(String metric,
                                         long used,
                                         long reserved,
                                         long quota,
                                         long available) {
    }

    public record UsageEventItemView(long userId,
                                     String projectId,
                                     String metric,
                                     long delta,
                                     String idempotencyKey,
                                     String sourceType,
                                     String sourceId,
                                     Instant occurredAt,
                                     Instant createdAt) {
    }

    public record UsageEventPageView(int page,
                                     int size,
                                     long total,
                                     List<UsageEventItemView> items) {
    }

    public record CurrentCycleUsageView(long userId,
                                        String projectId,
                                        String metric,
                                        long cycleId,
                                        long used,
                                        long reserved,
                                        long quota,
                                        long available,
                                        Instant validFrom,
                                        Instant validTo,
                                        Instant updatedAt) {
    }

    public record InviteItemView(long inviteId,
                                 String projectId,
                                 long creatorUserId,
                                 String status,
                                 Instant expiresAt,
                                 Instant revokedAt,
                                 int maxUses,
                                 int usedCount,
                                 Instant createdAt,
                                 Instant updatedAt) {
    }

    public record InvitePageView(int page,
                                 int size,
                                 long total,
                                 List<InviteItemView> items) {
    }

    public record TaskDlqIncidentItemView(Long incidentId,
                                          String messageId,
                                          String sourceQueue,
                                          String sourceRoutingKey,
                                          String dlqType,
                                          Long taskRecordId,
                                          Long parentTaskRecordId,
                                          String projectId,
                                          String kbId,
                                          String stageRunKey,
                                          String taskType,
                                          String payloadJson,
                                          String errorMessage,
                                          Integer retryCount,
                                          String incidentStatus,
                                          String compensationAction,
                                          Instant createdAt,
                                          Instant updatedAt) {
    }

    public record TaskDlqIncidentPageView(int page,
                                          int size,
                                          long total,
                                          List<TaskDlqIncidentItemView> items) {
    }
}
