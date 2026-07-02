// Responsibility: Expose stable authorization SDK facade for project-scoped access checks.
package com.notebook.learyAI.module.authz.interfaces.facade;

import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.AuthzDecision;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;

import java.util.Set;

public interface AuthzSdk {
    Long requireUserId();

    String requireProjectId(String projectId, String requiredCode, String invalidCode, String notFoundCode);

    AuthzDecision authorize(long userId, String projectId, Action action);

    ProjectRole requireRole(long userId, String projectId, Set<ProjectRole> allowedRoles);

    boolean isMember(long userId, String projectId);
}
