// Responsibility: Proxy preview STS cache access so policy concerns stay outside Redis implementation.
package com.notebook.learyAI.module.kbdoc.infrastructure.cache;

import com.notebook.learyAI.shared.storage.StsCredentials;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

@Component
@Primary
public class PreviewStsCacheProxy implements PreviewStsCache {
    private final PreviewStsCache delegate;
    private final RedisCacheSupport cacheSupport;
    private final KbDocCacheProperties properties;

    public PreviewStsCacheProxy(@Qualifier("redisPreviewStsCacheDelegate") PreviewStsCache delegate,
                                RedisCacheSupport cacheSupport,
                                KbDocCacheProperties properties) {
        this.delegate = delegate;
        this.cacheSupport = cacheSupport;
        this.properties = properties;
    }

    @Override
    public Optional<StsCredentials> get(String provider, Long userId) {
        if (!cacheEnabled()) {
            return Optional.empty();
        }
        return delegate.get(provider, userId);
    }

    @Override
    public void put(String provider, Long userId, StsCredentials credentials, Duration ttl) {
        Duration boundedTtl = resolveTtl(ttl);
        if (boundedTtl == null) {
            return;
        }
        delegate.put(provider, userId, credentials, boundedTtl);
    }

    private boolean cacheEnabled() {
        return cacheSupport.isEnabled() && properties.getPreviewStsTtlSeconds() > 0;
    }

    private Duration resolveTtl(Duration ttl) {
        if (!cacheEnabled() || ttl == null || ttl.isZero() || ttl.isNegative()) {
            return null;
        }
        Duration configuredTtl = Duration.ofSeconds(properties.getPreviewStsTtlSeconds());
        return ttl.compareTo(configuredTtl) > 0 ? configuredTtl : ttl;
    }
}
