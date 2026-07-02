// Responsibility: Evaluate whether a project role can perform a specific authorization action.
package com.notebook.learyAI.module.authz.domain.service;

import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;

public interface AuthzPolicyService {
    boolean isAllowed(ProjectRole role, Action action);
}

