// Responsibility: Provide access-layer quota checks on top of current-cycle usage and immediate commit flows.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageAction;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;
import com.notebook.learyAI.module.usage.interfaces.facade.UsageGuard;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageQuery;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageRecorder;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

@Service
public class UsageGuardAdapter implements UsageGuard {
    private final UsageRecorder usageRecorder;
    private final UsageQuery usageQuery;

    public UsageGuardAdapter(UsageRecorder usageRecorder, UsageQuery usageQuery) {
        this.usageRecorder = usageRecorder;
        this.usageQuery = usageQuery;
    }

    @Override
    public UsageDecision check(long userId, String projectId, UsageAction action, long delta) {
        validate(userId, projectId, action, delta);
        CurrentCycleUsage usage = usageQuery.getCurrentCycleUsage(userId, normalizeProjectId(projectId), action.metric());
        if (usage.available() < delta) {
            return UsageDecision.deny("USAGE-403", "quota exceeded", action.metric(), usage.used(), usage.quota());
        }
        return UsageDecision.allow(action.metric(), usage.used(), usage.quota());
    }

    @Override
    public UsageDecision checkAndConsume(long userId, String projectId, UsageAction action, long delta, String requestId) {
        validate(userId, projectId, action, delta);
        if (requestId == null || requestId.isBlank()) {
            throw new BizException("USAGE-400", "requestId required");
        }
        String normalizedProjectId = normalizeProjectId(projectId);
        String normalizedRequestId = requestId.trim();
        String reservationId = "guard:" + normalizedRequestId;
        usageRecorder.reserve(new ReserveUsageRequestDTO(
                userId,
                normalizedProjectId,
                action.metric(),
                reservationId,
                normalizedRequestId,
                delta,
                Duration.ofMinutes(5),
                Map.of()
        ));
        CurrentCycleUsage currentCycleUsage = usageRecorder.commit(new CommitUsageRequestDTO(
                userId,
                normalizedProjectId,
                action.metric(),
                reservationId,
                normalizedRequestId,
                delta,
                delta,
                "guard:" + normalizedRequestId + ":" + action.metric(),
                "access_guard",
                normalizedRequestId,
                Map.of(),
                Instant.now()
        )).currentCycle();
        return UsageDecision.allow(action.metric(), currentCycleUsage.used(), currentCycleUsage.quota());
    }

    private void validate(long userId, String projectId, UsageAction action, long delta) {
        if (userId <= 0) {
            throw new BizException("USAGE-400", "userId invalid");
        }
        if (action == null) {
            throw new BizException("USAGE-400", "action required");
        }
        if (delta <= 0) {
            throw new BizException("USAGE-400", "delta invalid");
        }
    }

    private String normalizeProjectId(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return "";
        }
        return projectId.trim();
    }
}
