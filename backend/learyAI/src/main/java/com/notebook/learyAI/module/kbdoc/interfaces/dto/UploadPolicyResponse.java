// Responsibility: Upload policy response payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import java.time.Instant;
import java.util.Map;

public class UploadPolicyResponse {
    private final String provider;
    private final String uploadUrl;
    private final String method;
    private final Map<String, String> headers;
    private final Map<String, String> fields;
    private final Instant expiresAt;

    public UploadPolicyResponse(String provider, String uploadUrl, String method,
                                Map<String, String> headers, Map<String, String> fields,
                                Instant expiresAt) {
        this.provider = provider;
        this.uploadUrl = uploadUrl;
        this.method = method;
        this.headers = headers;
        this.fields = fields;
        this.expiresAt = expiresAt;
    }

    public String getProvider() {
        return provider;
    }

    public String getUploadUrl() {
        return uploadUrl;
    }

    public String getMethod() {
        return method;
    }

    public Map<String, String> getHeaders() {
        return headers;
    }

    public Map<String, String> getFields() {
        return fields;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
