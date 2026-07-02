// Responsibility: Bridge authz cache invalidation facade to cache implementation.
package com.notebook.learyAI.module.authz.application;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzCacheEvictor;
import org.springframework.stereotype.Service;

import java.util.Collection;

@Service
public class AuthzCacheEvictorImpl implements AuthzCacheEvictor {
    private final AuthzQueryCache authzQueryCache;

    public AuthzCacheEvictorImpl(AuthzQueryCache authzQueryCache) {
        this.authzQueryCache = authzQueryCache;
    }

    @Override
    public void evictProjectExists(String projectId) {
        authzQueryCache.evictProjectExists(projectId);
    }

    @Override
    public void evictRole(String projectId, Long userId) {
        if (userId == null) {
            return;
        }
        authzQueryCache.evictRole(projectId, userId);
    }

    @Override
    public void evictRoles(String projectId, Collection<Long> userIds) {
        authzQueryCache.evictRoles(projectId, userIds);
    }

    @Override
    public void evictProjectRoles(String projectId) {
        authzQueryCache.evictRoleByProject(projectId);
    }
}
