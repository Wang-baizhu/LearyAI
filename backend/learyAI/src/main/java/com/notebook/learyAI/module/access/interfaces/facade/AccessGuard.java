// Responsibility: Expose unified access guard facade combining authz and usage checks.
package com.notebook.learyAI.module.access.interfaces.facade;

import com.notebook.learyAI.module.access.domain.model.AccessDecision;
import com.notebook.learyAI.module.usage.domain.model.UsageAction;

public interface AccessGuard {
    AccessDecision check(long userId, String projectId, UsageAction action, long delta);

    AccessDecision checkAndConsume(long userId, String projectId, UsageAction action, long delta, String requestId);
}

