// Responsibility: Provide a minimal default policy mapping between actions and allowed project roles.
package com.notebook.learyAI.module.authz.infrastructure.service;

import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import org.springframework.stereotype.Service;

@Service
public class DefaultAuthzPolicyService implements AuthzPolicyService {
    @Override
    public boolean isAllowed(ProjectRole role, Action action) {
        if (role == null || action == null) {
            return false;
        }
        return switch (action) {
            case VIEW -> true;
            case EDIT -> role == ProjectRole.OWNER || role == ProjectRole.ADMIN;
            case MANAGE -> role == ProjectRole.OWNER;
        };
    }
}

