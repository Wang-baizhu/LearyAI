// Responsibility: Bind knowledge base cache specific properties.
package com.notebook.learyAI.module.kb.infrastructure.cache;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "cache.kb")
public class KnowledgeBaseCacheProperties {
    private long listTtlSeconds = 120;
    private long recentTtlSeconds = 60;
    private long detailTtlSeconds = 60;

    public long getListTtlSeconds() {
        return listTtlSeconds;
    }

    public void setListTtlSeconds(long listTtlSeconds) {
        this.listTtlSeconds = listTtlSeconds;
    }

    public long getRecentTtlSeconds() {
        return recentTtlSeconds;
    }

    public void setRecentTtlSeconds(long recentTtlSeconds) {
        this.recentTtlSeconds = recentTtlSeconds;
    }

    public long getDetailTtlSeconds() {
        return detailTtlSeconds;
    }

    public void setDetailTtlSeconds(long detailTtlSeconds) {
        this.detailTtlSeconds = detailTtlSeconds;
    }
}
