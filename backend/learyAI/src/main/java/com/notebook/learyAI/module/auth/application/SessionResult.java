// Responsibility: Carry session creation result for API layer.
package com.notebook.learyAI.module.auth.application;

public class SessionResult {
    private final String sessionId;
    private final long cookieMaxAgeSeconds;

    public SessionResult(String sessionId, long cookieMaxAgeSeconds) {
        this.sessionId = sessionId;
        this.cookieMaxAgeSeconds = cookieMaxAgeSeconds;
    }

    public String getSessionId() {
        return sessionId;
    }

    public long getCookieMaxAgeSeconds() {
        return cookieMaxAgeSeconds;
    }
}
