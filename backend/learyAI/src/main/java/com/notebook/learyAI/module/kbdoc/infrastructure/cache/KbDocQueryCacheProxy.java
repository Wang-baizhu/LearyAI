// Responsibility: Proxy kb-doc query cache access so policy concerns stay outside Redis implementation.
package com.notebook.learyAI.module.kbdoc.infrastructure.cache;

import com.notebook.learyAI.module.kbdoc.application.cache.CachedValue;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Primary
public class KbDocQueryCacheProxy implements KbDocQueryCache {
    private final KbDocQueryCache delegate;
    private final RedisCacheSupport cacheSupport;
    private final KbDocCacheProperties properties;

    public KbDocQueryCacheProxy(@Qualifier("redisKbDocQueryCacheDelegate") KbDocQueryCache delegate,
                                RedisCacheSupport cacheSupport,
                                KbDocCacheProperties properties) {
        this.delegate = delegate;
        this.cacheSupport = cacheSupport;
        this.properties = properties;
    }

    @Override
    public CachedValue<KbDocPage> getList(String projectId, long userId, String search, String fileType, int page, int size,
                                          String kbId) {
        if (!listEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getList(projectId, userId, search, fileType, page, size, kbId);
    }

    @Override
    public void putList(String projectId, long userId, String search, String fileType, int page, int size, String kbId,
                        KbDocPage pageResult) {
        if (!listEnabled()) {
            return;
        }
        delegate.putList(projectId, userId, search, fileType, page, size, kbId, pageResult);
    }

    @Override
    public CachedValue<List<KbDocOption>> getDocOptions(String projectId, long userId, String search, String kbId) {
        if (!optionsEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getDocOptions(projectId, userId, search, kbId);
    }

    @Override
    public void putDocOptions(String projectId, long userId, String search, String kbId, List<KbDocOption> options) {
        if (!optionsEnabled()) {
            return;
        }
        delegate.putDocOptions(projectId, userId, search, kbId, options);
    }

    @Override
    public CachedValue<KbDoc> getDetail(String projectId, String docId, long userId) {
        if (!detailEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getDetail(projectId, docId, userId);
    }

    @Override
    public void putDetail(String projectId, String docId, long userId, KbDoc doc) {
        if (!detailEnabled()) {
            return;
        }
        delegate.putDetail(projectId, docId, userId, doc);
    }

    @Override
    public CachedValue<KbDocTextChunkPage> getChunks(String projectId, String docId, int startChunkSec, int size, long userId) {
        if (!chunksEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getChunks(projectId, docId, startChunkSec, size, userId);
    }

    @Override
    public void putChunks(String projectId, String docId, int startChunkSec, int size, long userId, KbDocTextChunkPage chunks) {
        if (!chunksEnabled()) {
            return;
        }
        delegate.putChunks(projectId, docId, startChunkSec, size, userId, chunks);
    }

    @Override
    public CachedValue<List<String>> getRecentIds(String projectId, int limit, long userId) {
        if (!recentEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getRecentIds(projectId, limit, userId);
    }

    @Override
    public void putRecentIds(String projectId, int limit, long userId, List<String> docIds) {
        if (!recentEnabled()) {
            return;
        }
        delegate.putRecentIds(projectId, limit, userId, docIds);
    }

    @Override
    public void evictProject(String projectId) {
        if (!listEnabled() && !optionsEnabled() && !detailEnabled() && !chunksEnabled() && !recentEnabled()) {
            return;
        }
        delegate.evictProject(projectId);
    }

    @Override
    public void evictDoc(String projectId, long docInternalId, String docId) {
        if (!listEnabled() && !optionsEnabled() && !detailEnabled() && !chunksEnabled() && !recentEnabled()) {
            return;
        }
        delegate.evictDoc(projectId, docInternalId, docId);
    }

    @Override
    public void evictDocByDocId(String projectId, String docId) {
        if (!listEnabled() && !optionsEnabled() && !detailEnabled() && !chunksEnabled() && !recentEnabled()) {
            return;
        }
        delegate.evictDocByDocId(projectId, docId);
    }

    private boolean listEnabled() {
        return cacheSupport.isEnabled() && properties.getListTtlSeconds() > 0;
    }

    private boolean optionsEnabled() {
        return cacheSupport.isEnabled() && properties.getOptionsTtlSeconds() > 0;
    }

    private boolean detailEnabled() {
        return cacheSupport.isEnabled() && properties.getDetailTtlSeconds() > 0;
    }

    private boolean chunksEnabled() {
        return cacheSupport.isEnabled() && properties.getChunksTtlSeconds() > 0;
    }

    private boolean recentEnabled() {
        return cacheSupport.isEnabled() && properties.getRecentTtlSeconds() > 0;
    }
}
