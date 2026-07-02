// Responsibility: Carry final access result composed from authz and usage decisions.
package com.notebook.learyAI.module.access.domain.model;

import com.notebook.learyAI.module.authz.domain.model.AuthzDecision;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;

public record AccessDecision(
        boolean allowed,
        String denyCode,
        String denyMessage,
        AuthzDecision authzDecision,
        UsageDecision usageDecision
) {
    public static AccessDecision fromAuthzDeny(AuthzDecision authzDecision) {
        return new AccessDecision(false, authzDecision.denyCode(), authzDecision.denyMessage(), authzDecision, null);
    }

    public static AccessDecision fromUsageDecision(AuthzDecision authzDecision, UsageDecision usageDecision) {
        if (usageDecision.allowed()) {
            return new AccessDecision(true, null, null, authzDecision, usageDecision);
        }
        return new AccessDecision(false, usageDecision.denyCode(), usageDecision.denyMessage(), authzDecision, usageDecision);
    }
}

