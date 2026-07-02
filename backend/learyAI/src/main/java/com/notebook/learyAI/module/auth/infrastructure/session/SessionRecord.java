// Responsibility: Redis session record payload.
package com.notebook.learyAI.module.auth.infrastructure.session;

import java.time.Instant;

public class SessionRecord {
    private String sessionId;
    private Long userId;
    private Instant expiresAt;
    private boolean rememberMe;
    private String ip;
    private String userAgent;
    private String deviceId;

    public SessionRecord() {
    }

    public SessionRecord(String sessionId, Long userId, Instant expiresAt, boolean rememberMe,
                         String ip, String userAgent, String deviceId) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.expiresAt = expiresAt;
        this.rememberMe = rememberMe;
        this.ip = ip;
        this.userAgent = userAgent;
        this.deviceId = deviceId;
    }

    public String getSessionId() {
        return sessionId;
    }

    public void setSessionId(String sessionId) {
        this.sessionId = sessionId;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(Instant expiresAt) {
        this.expiresAt = expiresAt;
    }

    public boolean isRememberMe() {
        return rememberMe;
    }

    public void setRememberMe(boolean rememberMe) {
        this.rememberMe = rememberMe;
    }

    public String getIp() {
        return ip;
    }

    public void setIp(String ip) {
        this.ip = ip;
    }

    public String getUserAgent() {
        return userAgent;
    }

    public void setUserAgent(String userAgent) {
        this.userAgent = userAgent;
    }

    public String getDeviceId() {
        return deviceId;
    }

    public void setDeviceId(String deviceId) {
        this.deviceId = deviceId;
    }
}
