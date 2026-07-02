// Responsibility: Proxy knowledge-base cache access so policy concerns stay outside Redis implementation.
package com.notebook.learyAI.module.kb.infrastructure.cache;

import com.notebook.learyAI.module.kb.application.cache.CachedValue;
import com.notebook.learyAI.module.kb.application.cache.KnowledgeBaseQueryCache;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@Primary
public class KnowledgeBaseQueryCacheProxy implements KnowledgeBaseQueryCache {
    private final KnowledgeBaseQueryCache delegate;
    private final RedisCacheSupport cacheSupport;
    private final KnowledgeBaseCacheProperties properties;

    public KnowledgeBaseQueryCacheProxy(@Qualifier("redisKnowledgeBaseQueryCacheDelegate") KnowledgeBaseQueryCache delegate,
                                        RedisCacheSupport cacheSupport,
                                        KnowledgeBaseCacheProperties properties) {
        this.delegate = delegate;
        this.cacheSupport = cacheSupport;
        this.properties = properties;
    }

    @Override
    public CachedValue<KnowledgeBasePage> getList(String projectId, long userId, boolean isMember, String search,
                                                  String tag, KnowledgeBaseSort sort, boolean desc, int page, int size) {
        if (!listEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getList(projectId, userId, isMember, search, tag, sort, desc, page, size);
    }

    @Override
    public void putList(String projectId, long userId, boolean isMember, String search, String tag, KnowledgeBaseSort sort,
                        boolean desc, int page, int size, KnowledgeBasePage pageResult) {
        if (!listEnabled()) {
            return;
        }
        delegate.putList(projectId, userId, isMember, search, tag, sort, desc, page, size, pageResult);
    }

    @Override
    public CachedValue<List<KnowledgeBase>> getRecent(String projectId, long userId, int limit) {
        if (!recentEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getRecent(projectId, userId, limit);
    }

    @Override
    public void putRecent(String projectId, long userId, int limit, List<KnowledgeBase> items) {
        if (!recentEnabled()) {
            return;
        }
        delegate.putRecent(projectId, userId, limit, items);
    }

    @Override
    public CachedValue<KnowledgeBase> getDetail(String projectId, String kbId, long userId) {
        if (!detailEnabled()) {
            return CachedValue.miss();
        }
        return delegate.getDetail(projectId, kbId, userId);
    }

    @Override
    public void putDetail(String projectId, String kbId, long userId, KnowledgeBase knowledgeBase) {
        if (!detailEnabled()) {
            return;
        }
        delegate.putDetail(projectId, kbId, userId, knowledgeBase);
    }

    @Override
    public void evictByProject(String projectId) {
        if (!listEnabled() && !recentEnabled() && !detailEnabled()) {
            return;
        }
        delegate.evictByProject(projectId);
    }

    @Override
    public void evictRecent(String projectId, long userId) {
        if (!recentEnabled()) {
            return;
        }
        delegate.evictRecent(projectId, userId);
    }

    @Override
    public void evictDetail(String projectId, String kbId) {
        if (!detailEnabled()) {
            return;
        }
        delegate.evictDetail(projectId, kbId);
    }

    private boolean listEnabled() {
        return cacheSupport.isEnabled() && properties.getListTtlSeconds() > 0;
    }

    private boolean recentEnabled() {
        return cacheSupport.isEnabled() && properties.getRecentTtlSeconds() > 0;
    }

    private boolean detailEnabled() {
        return cacheSupport.isEnabled() && properties.getDetailTtlSeconds() > 0;
    }
}
