// Responsibility: Response payload for STS credentials issuance.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import java.time.Instant;

public class PreviewCredentialsResponse {
    private final String provider;
    private final String accessKeyId;
    private final String secretAccessKey;
    private final String sessionToken;
    private final Instant expiration;
    private final String endpoint;
    private final String bucket;
    private final String prefix;

    public PreviewCredentialsResponse(String provider, String accessKeyId, String secretAccessKey, String sessionToken,
                                      Instant expiration, String endpoint, String bucket, String prefix) {
        this.provider = provider;
        this.accessKeyId = accessKeyId;
        this.secretAccessKey = secretAccessKey;
        this.sessionToken = sessionToken;
        this.expiration = expiration;
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

    public Instant getExpiration() {
        return expiration;
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
