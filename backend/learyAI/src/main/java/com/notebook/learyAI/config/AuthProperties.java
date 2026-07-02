// Responsibility: Bind authentication-related configuration properties.
package com.notebook.learyAI.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "auth")
public class AuthProperties {
    private final Session session = new Session();
    private final Login login = new Login();
    private final Cookie cookie = new Cookie();
    private final Sms sms = new Sms();
    private final Internal internal = new Internal();

    public Session getSession() {
        return session;
    }

    public Login getLogin() {
        return login;
    }

    public Cookie getCookie() {
        return cookie;
    }

    public Sms getSms() {
        return sms;
    }

    public Internal getInternal() {
        return internal;
    }

    public static class Session {
        private long ttlSeconds;
        private long rememberMeTtlSeconds;
        private long renewThresholdSeconds;
        private boolean testBypassEnabled;
        private String testBypassSessionId;
        private Long testBypassUserId;

        public long getTtlSeconds() {
            return ttlSeconds;
        }

        public void setTtlSeconds(long ttlSeconds) {
            this.ttlSeconds = ttlSeconds;
        }

        public long getRememberMeTtlSeconds() {
            return rememberMeTtlSeconds;
        }

        public void setRememberMeTtlSeconds(long rememberMeTtlSeconds) {
            this.rememberMeTtlSeconds = rememberMeTtlSeconds;
        }

        public long getRenewThresholdSeconds() {
            return renewThresholdSeconds;
        }

        public void setRenewThresholdSeconds(long renewThresholdSeconds) {
            this.renewThresholdSeconds = renewThresholdSeconds;
        }

        public boolean isTestBypassEnabled() {
            return testBypassEnabled;
        }

        public void setTestBypassEnabled(boolean testBypassEnabled) {
            this.testBypassEnabled = testBypassEnabled;
        }

        public String getTestBypassSessionId() {
            return testBypassSessionId;
        }

        public void setTestBypassSessionId(String testBypassSessionId) {
            this.testBypassSessionId = testBypassSessionId;
        }

        public Long getTestBypassUserId() {
            return testBypassUserId;
        }

        public void setTestBypassUserId(Long testBypassUserId) {
            this.testBypassUserId = testBypassUserId;
        }
    }

    public static class Login {
        private int maxFailures;
        private int lockMinutes;

        public int getMaxFailures() {
            return maxFailures;
        }

        public void setMaxFailures(int maxFailures) {
            this.maxFailures = maxFailures;
        }

        public int getLockMinutes() {
            return lockMinutes;
        }

        public void setLockMinutes(int lockMinutes) {
            this.lockMinutes = lockMinutes;
        }
    }

    public static class Cookie {
        private String name;
        private String sameSite;

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getSameSite() {
            return sameSite;
        }

        public void setSameSite(String sameSite) {
            this.sameSite = sameSite;
        }
    }

    public static class Sms {
        private int codeLength;
        private long codeTtlSeconds;
        private long resendIntervalSeconds;
        private long limitWindowSeconds;
        private int maxPerWindow;
        private final Aliyun aliyun = new Aliyun();

        public int getCodeLength() {
            return codeLength;
        }

        public void setCodeLength(int codeLength) {
            this.codeLength = codeLength;
        }

        public long getCodeTtlSeconds() {
            return codeTtlSeconds;
        }

        public void setCodeTtlSeconds(long codeTtlSeconds) {
            this.codeTtlSeconds = codeTtlSeconds;
        }

        public long getResendIntervalSeconds() {
            return resendIntervalSeconds;
        }

        public void setResendIntervalSeconds(long resendIntervalSeconds) {
            this.resendIntervalSeconds = resendIntervalSeconds;
        }

        public long getLimitWindowSeconds() {
            return limitWindowSeconds;
        }

        public void setLimitWindowSeconds(long limitWindowSeconds) {
            this.limitWindowSeconds = limitWindowSeconds;
        }

        public int getMaxPerWindow() {
            return maxPerWindow;
        }

        public void setMaxPerWindow(int maxPerWindow) {
            this.maxPerWindow = maxPerWindow;
        }

        public Aliyun getAliyun() {
            return aliyun;
        }
    }

    public static class Aliyun {
        private String accessKeyId;
        private String accessKeySecret;
        private String endpoint = "dypnsapi.aliyuncs.com";
        private String region = "cn-shenzhen";
        private String countryCode = "86";
        private int minMinutes = 5;
        private String templateParam = "{\"code\":\"{code}\",\"min\":\"{min}\"}";
        private String signName;
        private String templateCode;
        private String securityToken;

        public String getAccessKeyId() {
            return accessKeyId;
        }

        public void setAccessKeyId(String accessKeyId) {
            this.accessKeyId = accessKeyId;
        }

        public String getAccessKeySecret() {
            return accessKeySecret;
        }

        public void setAccessKeySecret(String accessKeySecret) {
            this.accessKeySecret = accessKeySecret;
        }

        public String getEndpoint() {
            return endpoint;
        }

        public void setEndpoint(String endpoint) {
            this.endpoint = endpoint;
        }

        public String getRegion() {
            return region;
        }

        public void setRegion(String region) {
            this.region = region;
        }

        public String getCountryCode() {
            return countryCode;
        }

        public void setCountryCode(String countryCode) {
            this.countryCode = countryCode;
        }

        public int getMinMinutes() {
            return minMinutes;
        }

        public void setMinMinutes(int minMinutes) {
            this.minMinutes = minMinutes;
        }

        public String getTemplateParam() {
            return templateParam;
        }

        public void setTemplateParam(String templateParam) {
            this.templateParam = templateParam;
        }

        public String getSignName() {
            return signName;
        }

        public void setSignName(String signName) {
            this.signName = signName;
        }

        public String getTemplateCode() {
            return templateCode;
        }

        public void setTemplateCode(String templateCode) {
            this.templateCode = templateCode;
        }

        public String getSecurityToken() {
            return securityToken;
        }

        public void setSecurityToken(String securityToken) {
            this.securityToken = securityToken;
        }
    }

    public static class Internal {
        private boolean enabled;
        private String headerName;
        private String token;
        private String sourceHeaderName = "X-Internal-Source";
        private java.util.List<String> sourceWhitelist = new java.util.ArrayList<>();

        public boolean isEnabled() {
            return enabled;
        }

        public void setEnabled(boolean enabled) {
            this.enabled = enabled;
        }

        public String getHeaderName() {
            return headerName;
        }

        public void setHeaderName(String headerName) {
            this.headerName = headerName;
        }

        public String getToken() {
            return token;
        }

        public void setToken(String token) {
            this.token = token;
        }

        public String getSourceHeaderName() {
            return sourceHeaderName;
        }

        public void setSourceHeaderName(String sourceHeaderName) {
            this.sourceHeaderName = sourceHeaderName;
        }

        public java.util.List<String> getSourceWhitelist() {
            return sourceWhitelist;
        }

        public void setSourceWhitelist(java.util.List<String> sourceWhitelist) {
            this.sourceWhitelist = sourceWhitelist;
        }
    }
}
