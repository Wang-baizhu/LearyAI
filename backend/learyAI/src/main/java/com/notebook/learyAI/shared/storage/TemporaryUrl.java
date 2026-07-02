// Responsibility: Describe temporary URL details for object storage.
package com.notebook.learyAI.shared.storage;

import java.time.Instant;

public class TemporaryUrl {
    private final String url;
    private final Instant expiresAt;

    public TemporaryUrl(String url, Instant expiresAt) {
        this.url = url;
        this.expiresAt = expiresAt;
    }

    public String getUrl() {
        return url;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
