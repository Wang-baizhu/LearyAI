// Responsibility: Define cache contract for authz project existence and membership role lookups.
package com.notebook.learyAI.module.authz.application.cache;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;

import java.util.Collection;

public interface AuthzQueryCache {
    CachedValue<Boolean> getProjectExists(String projectId);

    void putProjectExists(String projectId, boolean exists);

    CachedValue<ProjectRole> getRole(String projectId, long userId);

    void putRole(String projectId, long userId, ProjectRole role);

    void evictProjectExists(String projectId);

    void evictRole(String projectId, long userId);

    void evictRoles(String projectId, Collection<Long> userIds);

    void evictRoleByProject(String projectId);
}
