// Responsibility: Implement authz query cache with Redis.
package com.notebook.learyAI.module.authz.infrastructure.cache;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.application.cache.CachedValue;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Set;

@Component("redisAuthzQueryCacheDelegate")
public class RedisAuthzQueryCache implements AuthzQueryCache {
    private static final String PREFIX_PROJECT_EXISTS = "authz:project-exists:";
    private static final String PREFIX_ROLE = "authz:role:";

    private final RedisCacheSupport cacheSupport;
    private final StringRedisTemplate stringRedisTemplate;
    private final AuthzCacheProperties properties;

    public RedisAuthzQueryCache(RedisCacheSupport cacheSupport,
                                StringRedisTemplate stringRedisTemplate,
                                AuthzCacheProperties properties) {
        this.cacheSupport = cacheSupport;
        this.stringRedisTemplate = stringRedisTemplate;
        this.properties = properties;
    }

    @Override
    public CachedValue<Boolean> getProjectExists(String projectId) {
        if (isBlank(projectId)) {
            return CachedValue.miss();
        }
        return cacheSupport.get(projectExistsKey(projectId))
                .map(raw -> {
                    if (cacheSupport.isNullValue(raw)) {
                        return CachedValue.hit(Boolean.FALSE);
                    }
                    return CachedValue.hit(Boolean.parseBoolean(raw));
                })
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putProjectExists(String projectId, boolean exists) {
        if (isBlank(projectId)) {
            return;
        }
        String key = projectExistsKey(projectId);
        if (exists) {
            cacheSupport.put(key, Boolean.TRUE.toString(), Duration.ofSeconds(Math.max(1, properties.getProjectExistsTtlSeconds())));
            return;
        }
        cacheSupport.putNull(key, Duration.ofSeconds(Math.max(1, properties.getProjectExistsNullTtlSeconds())));
    }

    @Override
    public CachedValue<ProjectRole> getRole(String projectId, long userId) {
        if (isBlank(projectId) || userId <= 0) {
            return CachedValue.miss();
        }
        return cacheSupport.get(roleKey(projectId, userId))
                .map(raw -> {
                    if (cacheSupport.isNullValue(raw)) {
                        return CachedValue.<ProjectRole>hit(null);
                    }
                    try {
                        return CachedValue.hit(ProjectRole.valueOf(raw));
                    } catch (IllegalArgumentException ex) {
                        return CachedValue.<ProjectRole>miss();
                    }
                })
                .orElseGet(CachedValue::<ProjectRole>miss);
    }

    @Override
    public void putRole(String projectId, long userId, ProjectRole role) {
        if (isBlank(projectId) || userId <= 0) {
            return;
        }
        String key = roleKey(projectId, userId);
        if (role == null) {
            cacheSupport.putNull(key, Duration.ofSeconds(Math.max(1, properties.getRoleNullTtlSeconds())));
            return;
        }
        cacheSupport.put(key, role.name(), Duration.ofSeconds(Math.max(1, properties.getRoleTtlSeconds())));
    }

    @Override
    public void evictProjectExists(String projectId) {
        cacheSupport.deleteAfterCommit(projectExistsKey(projectId));
    }

    @Override
    public void evictRole(String projectId, long userId) {
        cacheSupport.deleteAfterCommit(roleKey(projectId, userId));
    }

    @Override
    public void evictRoles(String projectId, Collection<Long> userIds) {
        if (isBlank(projectId) || userIds == null || userIds.isEmpty()) {
            return;
        }
        Set<String> keys = new LinkedHashSet<>();
        for (Long userId : userIds) {
            if (userId == null || userId <= 0) {
                continue;
            }
            keys.add(roleKey(projectId, userId));
        }
        if (!keys.isEmpty()) {
            cacheSupport.deleteAfterCommit(keys);
        }
    }

    @Override
    public void evictRoleByProject(String projectId) {
        if (isBlank(projectId)) {
            return;
        }
        String pattern = PREFIX_ROLE + projectId + ":*";
        Set<String> keys = stringRedisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            return;
        }
        cacheSupport.deleteAfterCommit(keys);
    }

    private String projectExistsKey(String projectId) {
        return PREFIX_PROJECT_EXISTS + projectId;
    }

    private String roleKey(String projectId, long userId) {
        return PREFIX_ROLE + projectId + ":" + userId;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
