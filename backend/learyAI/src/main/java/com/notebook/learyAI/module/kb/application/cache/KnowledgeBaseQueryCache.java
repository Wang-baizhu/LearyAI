// Responsibility: Define cache operations for knowledge base read queries.
package com.notebook.learyAI.module.kb.application.cache;

import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort;

import java.util.List;

public interface KnowledgeBaseQueryCache {
    CachedValue<KnowledgeBasePage> getList(String projectId, long userId, boolean isMember, String search, String tag,
                                           KnowledgeBaseSort sort, boolean desc, int page, int size);

    void putList(String projectId, long userId, boolean isMember, String search, String tag, KnowledgeBaseSort sort,
                 boolean desc, int page, int size, KnowledgeBasePage pageResult);

    CachedValue<List<KnowledgeBase>> getRecent(String projectId, long userId, int limit);

    void putRecent(String projectId, long userId, int limit, List<KnowledgeBase> items);

    CachedValue<KnowledgeBase> getDetail(String projectId, String kbId, long userId);

    void putDetail(String projectId, String kbId, long userId, KnowledgeBase knowledgeBase);

    void evictByProject(String projectId);

    void evictRecent(String projectId, long userId);

    void evictDetail(String projectId, String kbId);
}
