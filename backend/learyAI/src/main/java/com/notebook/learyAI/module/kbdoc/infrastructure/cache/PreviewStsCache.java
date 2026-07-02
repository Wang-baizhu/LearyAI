// Responsibility: Define cache port for preview STS credentials.
package com.notebook.learyAI.module.kbdoc.infrastructure.cache;

import com.notebook.learyAI.shared.storage.StsCredentials;

import java.time.Duration;
import java.util.Optional;

public interface PreviewStsCache {
    Optional<StsCredentials> get(String provider, Long userId);

    void put(String provider, Long userId, StsCredentials credentials, Duration ttl);
}
