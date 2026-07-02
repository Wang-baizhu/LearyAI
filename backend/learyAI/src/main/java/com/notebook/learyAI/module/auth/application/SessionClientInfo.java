// Responsibility: Capture session-related client metadata.
package com.notebook.learyAI.module.auth.application;

public class SessionClientInfo {
    private final String ip;
    private final String userAgent;
    private final String deviceId;

    public SessionClientInfo(String ip, String userAgent, String deviceId) {
        this.ip = ip;
        this.userAgent = userAgent;
        this.deviceId = deviceId;
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
