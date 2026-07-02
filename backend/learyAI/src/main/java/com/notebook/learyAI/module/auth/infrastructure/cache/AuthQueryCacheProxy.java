// Responsibility: Proxy auth me cache access so cross-cutting cache controls stay outside Redis implementation.
package com.notebook.learyAI.module.auth.infrastructure.cache;

import com.notebook.learyAI.module.auth.application.AuthUserSummary;
import com.notebook.learyAI.module.auth.application.cache.AuthQueryCache;
import com.notebook.learyAI.module.auth.application.cache.CachedValue;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Component
@Primary
public class AuthQueryCacheProxy implements AuthQueryCache {
    private final AuthQueryCache delegate;
    private final RedisCacheSupport cacheSupport;
    private final AuthCacheProperties properties;

    public AuthQueryCacheProxy(@Qualifier("redisAuthQueryCacheDelegate") AuthQueryCache delegate,
                               RedisCacheSupport cacheSupport,
                               AuthCacheProperties properties) {
        this.delegate = delegate;
        this.cacheSupport = cacheSupport;
        this.properties = properties;
    }

    @Override
    public CachedValue<AuthUserSummary> getMe(long userId) {
        if (!meEnabled() && !meNullEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getMe(userId);
    }

    @Override
    public void putMe(long userId, AuthUserSummary summary) {
        if (summary == null ? !meNullEnabled() : !meEnabled()) {
            return;
        }
        delegate.putMe(userId, summary);
    }

    @Override
    public void evictMe(long userId) {
        if (!meEnabled() && !meNullEnabled()) {
            return;
        }
        delegate.evictMe(userId);
    }

    private boolean meEnabled() {
        return cacheSupport.isEnabled() && properties.getMeTtlSeconds() > 0;
    }

    private boolean meNullEnabled() {
        return cacheSupport.isEnabled() && properties.getMeNullTtlSeconds() > 0;
    }
}
