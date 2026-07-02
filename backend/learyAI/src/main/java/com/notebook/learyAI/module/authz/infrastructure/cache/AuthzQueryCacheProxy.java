// Responsibility: Proxy authz cache access so enablement and future cache policies stay outside Redis implementation.
package com.notebook.learyAI.module.authz.infrastructure.cache;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.application.cache.CachedValue;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.Collection;

@Component
@Primary
public class AuthzQueryCacheProxy implements AuthzQueryCache {
    private final AuthzQueryCache delegate;
    private final RedisCacheSupport cacheSupport;
    private final AuthzCacheProperties properties;

    public AuthzQueryCacheProxy(@Qualifier("redisAuthzQueryCacheDelegate") AuthzQueryCache delegate,
                                RedisCacheSupport cacheSupport,
                                AuthzCacheProperties properties) {
        this.delegate = delegate;
        this.cacheSupport = cacheSupport;
        this.properties = properties;
    }

    @Override
    public CachedValue<Boolean> getProjectExists(String projectId) {
        if (!projectExistsEnabled() && !projectExistsNullEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getProjectExists(projectId);
    }

    @Override
    public void putProjectExists(String projectId, boolean exists) {
        if (exists ? !projectExistsEnabled() : !projectExistsNullEnabled()) {
            return;
        }
        delegate.putProjectExists(projectId, exists);
    }

    @Override
    public CachedValue<ProjectRole> getRole(String projectId, long userId) {
        if (!roleEnabled() && !roleNullEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getRole(projectId, userId);
    }

    @Override
    public void putRole(String projectId, long userId, ProjectRole role) {
        if (role == null ? !roleNullEnabled() : !roleEnabled()) {
            return;
        }
        delegate.putRole(projectId, userId, role);
    }

    @Override
    public void evictProjectExists(String projectId) {
        if (!projectExistsEnabled() && !projectExistsNullEnabled()) {
            return;
        }
        delegate.evictProjectExists(projectId);
    }

    @Override
    public void evictRole(String projectId, long userId) {
        if (!roleEnabled() && !roleNullEnabled()) {
            return;
        }
        delegate.evictRole(projectId, userId);
    }

    @Override
    public void evictRoles(String projectId, Collection<Long> userIds) {
        if (!roleEnabled() && !roleNullEnabled()) {
            return;
        }
        delegate.evictRoles(projectId, userIds);
    }

    @Override
    public void evictRoleByProject(String projectId) {
        if (!roleEnabled() && !roleNullEnabled()) {
            return;
        }
        delegate.evictRoleByProject(projectId);
    }

    private boolean projectExistsEnabled() {
        return cacheSupport.isEnabled() && properties.getProjectExistsTtlSeconds() > 0;
    }

    private boolean projectExistsNullEnabled() {
        return cacheSupport.isEnabled() && properties.getProjectExistsNullTtlSeconds() > 0;
    }

    private boolean roleEnabled() {
        return cacheSupport.isEnabled() && properties.getRoleTtlSeconds() > 0;
    }

    private boolean roleNullEnabled() {
        return cacheSupport.isEnabled() && properties.getRoleNullTtlSeconds() > 0;
    }
}
