// Responsibility: Define cache operations for kb-doc read queries and invalidation.
package com.notebook.learyAI.module.kbdoc.application.cache;

import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;

import java.util.List;

public interface KbDocQueryCache {
    CachedValue<KbDocPage> getList(String projectId, long userId, String search, String fileType,
                                   int page, int size, String kbId);

    void putList(String projectId, long userId, String search, String fileType, int page, int size, String kbId,
                 KbDocPage pageResult);

    CachedValue<List<KbDocOption>> getDocOptions(String projectId, long userId, String search, String kbId);

    void putDocOptions(String projectId, long userId, String search, String kbId, List<KbDocOption> options);

    CachedValue<KbDoc> getDetail(String projectId, String docId, long userId);

    void putDetail(String projectId, String docId, long userId, KbDoc doc);

    CachedValue<KbDocTextChunkPage> getChunks(String projectId, String docId, int startChunkSec, int size, long userId);

    void putChunks(String projectId, String docId, int startChunkSec, int size, long userId, KbDocTextChunkPage chunks);

    CachedValue<List<String>> getRecentIds(String projectId, int limit, long userId);

    void putRecentIds(String projectId, int limit, long userId, List<String> docIds);

    void evictProject(String projectId);

    void evictDoc(String projectId, long docInternalId, String docId);

    void evictDocByDocId(String projectId, String docId);
}

