// Responsibility: Encapsulate auth session policies and TTL decisions.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.config.AuthProperties;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class AuthPolicy {
    private final AuthProperties authProperties;

    public AuthPolicy(AuthProperties authProperties) {
        this.authProperties = authProperties;
    }

    public long resolveSessionTtlSeconds(boolean rememberMe) {
        return rememberMe
                ? authProperties.getSession().getRememberMeTtlSeconds()
                : authProperties.getSession().getTtlSeconds();
    }

    public boolean shouldRenew(boolean rememberMe, Instant expiresAt, Instant now) {
        if (rememberMe) {
            return false;
        }
        long thresholdSeconds = authProperties.getSession().getRenewThresholdSeconds();
        return expiresAt.minusSeconds(thresholdSeconds).isBefore(now);
    }

    public Instant renewExpiry(Instant now) {
        return now.plusSeconds(authProperties.getSession().getTtlSeconds());
    }
}
