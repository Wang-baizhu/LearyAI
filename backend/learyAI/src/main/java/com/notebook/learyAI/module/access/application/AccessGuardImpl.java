// Responsibility: Implement unified access checks with strict authz-then-usage execution order.
package com.notebook.learyAI.module.access.application;

import com.notebook.learyAI.module.access.domain.model.AccessDecision;
import com.notebook.learyAI.module.access.interfaces.facade.AccessGuard;
import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.AuthzDecision;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.usage.domain.model.UsageAction;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;
import com.notebook.learyAI.module.usage.interfaces.facade.UsageGuard;
import org.springframework.stereotype.Service;

@Service
public class AccessGuardImpl implements AccessGuard {
    private final AuthzSdk authzSdk;
    private final UsageGuard usageGuard;

    public AccessGuardImpl(AuthzSdk authzSdk, UsageGuard usageGuard) {
        this.authzSdk = authzSdk;
        this.usageGuard = usageGuard;
    }

    @Override
    public AccessDecision check(long userId, String projectId, UsageAction action, long delta) {
        AuthzDecision authzDecision = authzSdk.authorize(userId, projectId, toAuthzAction(action));
        if (!authzDecision.allowed()) {
            return AccessDecision.fromAuthzDeny(authzDecision);
        }
        UsageDecision usageDecision = usageGuard.check(userId, projectId, action, delta);
        return AccessDecision.fromUsageDecision(authzDecision, usageDecision);
    }

    @Override
    public AccessDecision checkAndConsume(long userId, String projectId, UsageAction action, long delta, String requestId) {
        AuthzDecision authzDecision = authzSdk.authorize(userId, projectId, toAuthzAction(action));
        if (!authzDecision.allowed()) {
            return AccessDecision.fromAuthzDeny(authzDecision);
        }
        UsageDecision usageDecision = usageGuard.checkAndConsume(userId, projectId, action, delta, requestId);
        return AccessDecision.fromUsageDecision(authzDecision, usageDecision);
    }

    private Action toAuthzAction(UsageAction action) {
        if (action == null) {
            return Action.VIEW;
        }
        return switch (action) {
            case DOC_UPLOAD_BYTES, KBDOC_SIZE, TEMPLATE_GENERATE_COUNT -> Action.EDIT;
            case AI_CHAT_TOKENS -> Action.VIEW;
        };
    }
}
