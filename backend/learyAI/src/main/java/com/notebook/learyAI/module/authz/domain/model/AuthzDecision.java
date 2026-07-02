// Responsibility: Carry normalized authorization decision details.
package com.notebook.learyAI.module.authz.domain.model;

public record AuthzDecision(
        boolean allowed,
        String denyCode,
        String denyMessage,
        ProjectRole role,
        long membershipVersion
) {
    public static AuthzDecision allow(ProjectRole role) {
        return new AuthzDecision(true, null, null, role, 0L);
    }

    public static AuthzDecision deny(String denyCode, String denyMessage, ProjectRole role) {
        return new AuthzDecision(false, denyCode, denyMessage, role, 0L);
    }
}

