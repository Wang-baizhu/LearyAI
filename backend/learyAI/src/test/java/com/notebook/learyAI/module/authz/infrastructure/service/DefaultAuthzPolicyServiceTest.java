// Responsibility: Verify DefaultAuthzPolicyService role-action matrix.
package com.notebook.learyAI.module.authz.infrastructure.service;

import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DefaultAuthzPolicyServiceTest {
    private final DefaultAuthzPolicyService policy = new DefaultAuthzPolicyService();

    @Test
    @DisplayName("VIEW 对所有角色允许")
    void view_shouldAllowAllRoles() {
        assertTrue(policy.isAllowed(ProjectRole.OWNER, Action.VIEW));
        assertTrue(policy.isAllowed(ProjectRole.ADMIN, Action.VIEW));
        assertTrue(policy.isAllowed(ProjectRole.MEMBER, Action.VIEW));
    }

    @Test
    @DisplayName("EDIT 仅 OWNER/ADMIN 允许，MANAGE 仅 OWNER 允许")
    void editAndManage_shouldFollowRoleRules() {
        assertTrue(policy.isAllowed(ProjectRole.OWNER, Action.EDIT));
        assertTrue(policy.isAllowed(ProjectRole.ADMIN, Action.EDIT));
        assertFalse(policy.isAllowed(ProjectRole.MEMBER, Action.EDIT));

        assertTrue(policy.isAllowed(ProjectRole.OWNER, Action.MANAGE));
        assertFalse(policy.isAllowed(ProjectRole.ADMIN, Action.MANAGE));
        assertFalse(policy.isAllowed(ProjectRole.MEMBER, Action.MANAGE));
    }
}
