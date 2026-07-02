// Responsibility: Abstract project membership and role lookups for authorization decisions.
package com.notebook.learyAI.module.authz.domain.repository;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;

import java.util.Optional;

public interface MembershipQueryRepository {
    boolean projectExists(String projectId);

    Optional<ProjectRole> findRole(String projectId, long userId);
}

