// Responsibility: Bind auth cache specific properties.
package com.notebook.learyAI.module.auth.infrastructure.cache;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "cache.auth")
public class AuthCacheProperties {
    private long meTtlSeconds = 60;
    private long meNullTtlSeconds = 20;

    public long getMeTtlSeconds() {
        return meTtlSeconds;
    }

    public void setMeTtlSeconds(long meTtlSeconds) {
        this.meTtlSeconds = meTtlSeconds;
    }

    public long getMeNullTtlSeconds() {
        return meNullTtlSeconds;
    }

    public void setMeNullTtlSeconds(long meNullTtlSeconds) {
        this.meNullTtlSeconds = meNullTtlSeconds;
    }
}
