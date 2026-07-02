// Responsibility: Expose project-scoped quota checks and immediate consumption helpers.
package com.notebook.learyAI.module.usage.interfaces.facade;

import com.notebook.learyAI.module.usage.domain.model.UsageAction;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;

public interface UsageGuard {
    UsageDecision check(long userId, String projectId, UsageAction action, long delta);

    UsageDecision checkAndConsume(long userId, String projectId, UsageAction action, long delta, String requestId);
}
