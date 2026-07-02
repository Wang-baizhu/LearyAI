// Responsibility: Bind usage cache specific properties.
package com.notebook.learyAI.module.usage.infrastructure.cache;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "cache.usage")
public class UsageCacheProperties {
    private long snapshotExtraTtlSeconds = 3600;

    public long getSnapshotExtraTtlSeconds() {
        return snapshotExtraTtlSeconds;
    }

    public void setSnapshotExtraTtlSeconds(long snapshotExtraTtlSeconds) {
        this.snapshotExtraTtlSeconds = snapshotExtraTtlSeconds;
    }
}
