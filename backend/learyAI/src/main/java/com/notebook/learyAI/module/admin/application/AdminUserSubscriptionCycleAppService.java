// Responsibility: Enforce admin-only management of user subscription cycles and quota settings.
package com.notebook.learyAI.module.admin.application;

import com.notebook.learyAI.module.admin.domain.repository.AdminUserReadRepository;
import com.notebook.learyAI.module.auth.application.PlatformAdminGuard;
import com.notebook.learyAI.module.usage.application.dto.UpsertSubscriptionCycleRequestDTO;
import com.notebook.learyAI.module.usage.application.service.SubscriptionCycleAdminAppService;
import com.notebook.learyAI.module.usage.domain.model.SubscriptionCycle;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class AdminUserSubscriptionCycleAppService {
    private final PlatformAdminGuard platformAdminGuard;
    private final AdminUserReadRepository adminUserReadRepository;
    private final SubscriptionCycleAdminAppService subscriptionCycleAdminAppService;

    public AdminUserSubscriptionCycleAppService(PlatformAdminGuard platformAdminGuard,
                                                AdminUserReadRepository adminUserReadRepository,
                                                SubscriptionCycleAdminAppService subscriptionCycleAdminAppService) {
        this.platformAdminGuard = platformAdminGuard;
        this.adminUserReadRepository = adminUserReadRepository;
        this.subscriptionCycleAdminAppService = subscriptionCycleAdminAppService;
    }

    public List<SubscriptionCycleView> listUserCycles(long userId, String metric) {
        platformAdminGuard.requireAdmin();
        requireUserExists(userId);
        return subscriptionCycleAdminAppService.listUserCycles(userId, metric).stream()
                .map(this::toView)
                .toList();
    }

    public SubscriptionCycleView updateUserCycle(long userId,
                                                 String metric,
                                                 String planId,
                                                 long quota,
                                                 Instant validFrom,
                                                 Instant validTo) {
        platformAdminGuard.requireAdmin();
        requireUserExists(userId);
        SubscriptionCycle cycle = subscriptionCycleAdminAppService.upsertCycle(
                new UpsertSubscriptionCycleRequestDTO(userId, metric, planId, quota, validFrom, validTo)
        );
        return toView(cycle);
    }

    private void requireUserExists(long userId) {
        if (!adminUserReadRepository.existsByUserId(userId)) {
            throw new BizException("USER-404", "user not found");
        }
    }

    private SubscriptionCycleView toView(SubscriptionCycle cycle) {
        return new SubscriptionCycleView(
                cycle.id(),
                cycle.userId(),
                cycle.metric(),
                cycle.planId(),
                cycle.quota(),
                cycle.validFrom(),
                cycle.validTo(),
                cycle.status(),
                cycle.createdAt(),
                cycle.updatedAt()
        );
    }

    public record SubscriptionCycleView(Long id,
                                        long userId,
                                        String metric,
                                        String planId,
                                        long quota,
                                        Instant validFrom,
                                        Instant validTo,
                                        String status,
                                        Instant createdAt,
                                        Instant updatedAt) {
    }
}
