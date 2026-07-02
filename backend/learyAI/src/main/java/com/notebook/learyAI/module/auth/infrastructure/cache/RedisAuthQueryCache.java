// Responsibility: Implement auth me query cache with Redis.
package com.notebook.learyAI.module.auth.infrastructure.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.auth.application.AuthUserSummary;
import com.notebook.learyAI.module.auth.application.cache.AuthQueryCache;
import com.notebook.learyAI.module.auth.application.cache.CachedValue;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

@Component("redisAuthQueryCacheDelegate")
public class RedisAuthQueryCache implements AuthQueryCache {
    private static final String PREFIX_ME = "auth:me:";

    private final RedisCacheSupport cacheSupport;
    private final ObjectMapper objectMapper;
    private final AuthCacheProperties properties;

    public RedisAuthQueryCache(RedisCacheSupport cacheSupport,
                               ObjectMapper objectMapper,
                               AuthCacheProperties properties) {
        this.cacheSupport = cacheSupport;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    public CachedValue<AuthUserSummary> getMe(long userId) {
        if (userId <= 0) {
            return CachedValue.miss();
        }
        return cacheSupport.get(meKey(userId))
                .map(raw -> {
                    if (cacheSupport.isNullValue(raw)) {
                        return CachedValue.<AuthUserSummary>hit(null);
                    }
                    return readSummary(raw).<CachedValue<AuthUserSummary>>map(CachedValue::hit)
                            .orElseGet(CachedValue::miss);
                })
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putMe(long userId, AuthUserSummary summary) {
        if (userId <= 0) {
            return;
        }
        String key = meKey(userId);
        if (summary == null) {
            cacheSupport.putNull(key, Duration.ofSeconds(Math.max(1, properties.getMeNullTtlSeconds())));
            return;
        }
        try {
            cacheSupport.put(key, objectMapper.writeValueAsString(toPayload(summary)),
                    Duration.ofSeconds(Math.max(1, properties.getMeTtlSeconds())));
        } catch (JsonProcessingException ex) {
            cacheSupport.delete(key);
        }
    }

    @Override
    public void evictMe(long userId) {
        if (userId <= 0) {
            return;
        }
        cacheSupport.deleteAfterCommit(meKey(userId));
    }

    private Optional<AuthUserSummary> readSummary(String raw) {
        try {
            return Optional.of(fromPayload(objectMapper.readValue(raw, AuthSummaryPayload.class)));
        } catch (JsonProcessingException ex) {
            return Optional.empty();
        }
    }

    private AuthSummaryPayload toPayload(AuthUserSummary summary) {
        AuthSummaryPayload payload = new AuthSummaryPayload();
        payload.userId = summary.getUserId();
        payload.name = summary.getName();
        payload.email = summary.getEmail();
        payload.phone = summary.getPhone();
        payload.userMode = summary.getUserMode();
        return payload;
    }

    private AuthUserSummary fromPayload(AuthSummaryPayload payload) {
        return new AuthUserSummary(payload.userId, payload.name, payload.email, payload.phone, payload.userMode);
    }

    private String meKey(long userId) {
        return PREFIX_ME + userId;
    }

    private static class AuthSummaryPayload {
        public Long userId;
        public String name;
        public String email;
        public String phone;
        public String userMode;
    }
}
