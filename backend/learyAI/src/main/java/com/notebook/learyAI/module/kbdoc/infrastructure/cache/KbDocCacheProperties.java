// Responsibility: Bind kb-doc cache specific properties.
package com.notebook.learyAI.module.kbdoc.infrastructure.cache;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "cache.kbdoc")
public class KbDocCacheProperties {
    private long listTtlSeconds = 60;
    private long optionsTtlSeconds = 60;
    private long detailTtlSeconds = 60;
    private long chunksTtlSeconds = 180;
    private long recentTtlSeconds = 60;
    private long previewStsTtlSeconds = 3600;

    public long getListTtlSeconds() {
        return listTtlSeconds;
    }

    public void setListTtlSeconds(long listTtlSeconds) {
        this.listTtlSeconds = listTtlSeconds;
    }

    public long getOptionsTtlSeconds() {
        return optionsTtlSeconds;
    }

    public void setOptionsTtlSeconds(long optionsTtlSeconds) {
        this.optionsTtlSeconds = optionsTtlSeconds;
    }

    public long getDetailTtlSeconds() {
        return detailTtlSeconds;
    }

    public void setDetailTtlSeconds(long detailTtlSeconds) {
        this.detailTtlSeconds = detailTtlSeconds;
    }

    public long getChunksTtlSeconds() {
        return chunksTtlSeconds;
    }

    public void setChunksTtlSeconds(long chunksTtlSeconds) {
        this.chunksTtlSeconds = chunksTtlSeconds;
    }

    public long getRecentTtlSeconds() {
        return recentTtlSeconds;
    }

    public void setRecentTtlSeconds(long recentTtlSeconds) {
        this.recentTtlSeconds = recentTtlSeconds;
    }

    public long getPreviewStsTtlSeconds() {
        return previewStsTtlSeconds;
    }

    public void setPreviewStsTtlSeconds(long previewStsTtlSeconds) {
        this.previewStsTtlSeconds = previewStsTtlSeconds;
    }
}
