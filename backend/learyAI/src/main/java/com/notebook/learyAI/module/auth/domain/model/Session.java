// Responsibility: Auth session domain entity.
package com.notebook.learyAI.module.auth.domain.model;

import java.time.Instant;

public class Session {
    private final String sessionId;
    private final Long userId;
    private final Instant expiresAt;
    private final boolean rememberMe;
    private final String ip;
    private final String userAgent;
    private final String deviceId;

    public Session(String sessionId, Long userId, Instant expiresAt, boolean rememberMe,
                   String ip, String userAgent, String deviceId) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.expiresAt = expiresAt;
        this.rememberMe = rememberMe;
        this.ip = ip;
        this.userAgent = userAgent;
        this.deviceId = deviceId;
    }

    public Session withExpiresAt(Instant expiresAt) {
        return new Session(this.sessionId, this.userId, expiresAt, this.rememberMe, this.ip, this.userAgent,
                this.deviceId);
    }

    public String getSessionId() {
        return sessionId;
    }

    public Long getUserId() {
        return userId;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public boolean isRememberMe() {
        return rememberMe;
    }

    public String getIp() {
        return ip;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public String getDeviceId() {
        return deviceId;
    }
}
