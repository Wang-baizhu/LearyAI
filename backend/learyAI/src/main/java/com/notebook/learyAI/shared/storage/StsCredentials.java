// Responsibility: Describe STS credential details for object storage access.
package com.notebook.learyAI.shared.storage;

import java.time.Instant;

public class StsCredentials {
    private final String provider;
    private final String accessKeyId;
    private final String secretAccessKey;
    private final String sessionToken;
    private final Instant expiresAt;
    private final String endpoint;
    private final String bucket;
    private final String prefix;

    public StsCredentials(String provider, String accessKeyId, String secretAccessKey, String sessionToken,
                          Instant expiresAt, String endpoint, String bucket, String prefix) {
        this.provider = provider;
        this.accessKeyId = accessKeyId;
        this.secretAccessKey = secretAccessKey;
        this.sessionToken = sessionToken;
        this.expiresAt = expiresAt;
        this.endpoint = endpoint;
        this.bucket = bucket;
        this.prefix = prefix;
    }

    public String getProvider() {
        return provider;
    }

    public String getAccessKeyId() {
        return accessKeyId;
    }

    public String getSecretAccessKey() {
        return secretAccessKey;
    }

    public String getSessionToken() {
        return sessionToken;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public String getBucket() {
        return bucket;
    }

    public String getPrefix() {
        return prefix;
    }
}
