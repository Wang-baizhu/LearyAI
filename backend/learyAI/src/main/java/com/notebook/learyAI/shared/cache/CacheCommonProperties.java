// Responsibility: Bind shared cache behavior configuration.
package com.notebook.learyAI.shared.cache;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "cache.common")
public class CacheCommonProperties {
    private boolean enabled = true;
    private int jitterPercent = 20;
    private long nullTtlSeconds = 20;
    private boolean secondDeleteEnabled = true;
    private long secondDeleteDelayMillis = 300;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getJitterPercent() {
        return jitterPercent;
    }

    public void setJitterPercent(int jitterPercent) {
        this.jitterPercent = jitterPercent;
    }

    public long getNullTtlSeconds() {
        return nullTtlSeconds;
    }

    public void setNullTtlSeconds(long nullTtlSeconds) {
        this.nullTtlSeconds = nullTtlSeconds;
    }

    public boolean isSecondDeleteEnabled() {
        return secondDeleteEnabled;
    }

    public void setSecondDeleteEnabled(boolean secondDeleteEnabled) {
        this.secondDeleteEnabled = secondDeleteEnabled;
    }

    public long getSecondDeleteDelayMillis() {
        return secondDeleteDelayMillis;
    }

    public void setSecondDeleteDelayMillis(long secondDeleteDelayMillis) {
        this.secondDeleteDelayMillis = secondDeleteDelayMillis;
    }
}
