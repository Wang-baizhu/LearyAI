// Responsibility: Handle knowledge base document query use cases.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.kb.application.KnowledgeBaseAppService;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kbdoc.application.cache.CachedValue;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunk;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class KbDocQueryAppService {
    private static final int MAX_PAGE_SIZE = 100;
    private static final int MAX_RECENT_LIMIT = 50;
    private static final int DEFAULT_CHUNK_START = 1;
    private static final int DEFAULT_CHUNK_PAGE_SIZE = 20;
    private static final int MAX_CHUNK_PAGE_SIZE = 100;

    private final KbDocRepository docRepository;
    private final KnowledgeBaseAppService knowledgeBaseAppService;
    private final KbDocAppSupport support;
    private final KbDocQueryCache kbDocQueryCache;

    public KbDocQueryAppService(KbDocRepository docRepository,
                                KnowledgeBaseAppService knowledgeBaseAppService,
                                KbDocAppSupport support,
                                KbDocQueryCache kbDocQueryCache) {
        this.docRepository = docRepository;
        this.knowledgeBaseAppService = knowledgeBaseAppService;
        this.support = support;
        this.kbDocQueryCache = kbDocQueryCache;
    }

    public List<String> listRecentIds(String projectId, Integer limit) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        support.requireMember(normalizedProjectId, userId);
        int safeLimit = limit == null ? 10 : limit;
        if (safeLimit < 1 || safeLimit > MAX_RECENT_LIMIT) {
            throw new BizException("KB-400", "limit invalid");
        }
        CachedValue<List<String>> cached = kbDocQueryCache.getRecentIds(normalizedProjectId, safeLimit, userId);
        if (cached.isHit() && cached.getValue() != null) {
            return cached.getValue();
        }
        List<String> recentIds = docRepository.findRecentDocIds(normalizedProjectId, safeLimit);
        kbDocQueryCache.putRecentIds(normalizedProjectId, safeLimit, userId, recentIds);
        return recentIds;
    }

    public KbDocPage list(String projectId, String search, String fileType, Integer page, Integer size, String kbId) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        int safePage = page == null ? 1 : page;
        int safeSize = size == null ? 20 : size;
        if (safePage < 1 || safeSize < 1 || safeSize > MAX_PAGE_SIZE) {
            throw new BizException("KB-400", "pagination invalid");
        }
        String normalizedSearch = support.normalizeOptional(search);
        String normalizedType = support.normalizeOptional(fileType);
        Long kbInternalId = null;
        String docProjectId = normalizedProjectId;
        if (kbId != null && !kbId.isBlank()) {
            KnowledgeBase knowledgeBase = support.requireKb(kbId, userId, false);
            kbInternalId = knowledgeBase.getId();
            docProjectId = knowledgeBase.getProjectId();
            knowledgeBaseAppService.recordVisit(docProjectId, knowledgeBase.getKbId(), Instant.now());
        } else {
            support.requireMember(normalizedProjectId, userId);
        }
        CachedValue<KbDocPage> cached = kbDocQueryCache.getList(
                docProjectId, userId, normalizedSearch, normalizedType, safePage, safeSize,
                kbId == null || kbId.isBlank() ? null : kbId.trim()
        );
        if (cached.isHit() && cached.getValue() != null) {
            return cached.getValue();
        }
        KbDocPage pageResult = docRepository.search(docProjectId, normalizedSearch, normalizedType, safePage, safeSize,
                kbInternalId);
        kbDocQueryCache.putList(
                docProjectId, userId, normalizedSearch, normalizedType, safePage, safeSize,
                kbId == null || kbId.isBlank() ? null : kbId.trim(), pageResult
        );
        return pageResult;
    }

    public List<KbDocOption> listDocOptions(String projectId, String search, String kbId) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        String normalizedSearch = support.normalizeOptional(search);
        Long kbInternalId = null;
        String normalizedKbId = kbId == null || kbId.isBlank() ? null : kbId.trim();
        String docProjectId = normalizedProjectId;
        if (normalizedKbId != null) {
            KnowledgeBase knowledgeBase = support.requireKb(normalizedKbId, userId, false);
            kbInternalId = knowledgeBase.getId();
            docProjectId = knowledgeBase.getProjectId();
        } else {
            support.requireMember(normalizedProjectId, userId);
        }
        CachedValue<List<KbDocOption>> cached = kbDocQueryCache.getDocOptions(
                docProjectId, userId, normalizedSearch, normalizedKbId
        );
        if (cached.isHit() && cached.getValue() != null) {
            return cached.getValue();
        }
        List<KbDocOption> options = docRepository.findDocOptions(
                docProjectId,
                normalizedSearch,
                kbInternalId
        );
        kbDocQueryCache.putDocOptions(docProjectId, userId, normalizedSearch, normalizedKbId, options);
        return options;
    }

    public KbDoc getByDocId(String projectId, String docId) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        support.requireMember(normalizedProjectId, userId);
        String normalizedDocId = support.normalizeRequired(docId, "docId");
        CachedValue<KbDoc> cached = kbDocQueryCache.getDetail(normalizedProjectId, normalizedDocId, userId);
        if (cached.isHit() && cached.getValue() != null) {
            return cached.getValue();
        }
        KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        kbDocQueryCache.putDetail(normalizedProjectId, normalizedDocId, userId, doc);
        return doc;
    }

    public KbDocTextChunkPage listTextChunks(String projectId, String docId, Integer startChunkSec, Integer size) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        String normalizedDocId = support.normalizeRequired(docId, "docId");
        int safeStartChunkSec = startChunkSec == null ? DEFAULT_CHUNK_START : startChunkSec;
        int safeSize = size == null ? DEFAULT_CHUNK_PAGE_SIZE : size;
        if (safeStartChunkSec < 1) {
            throw new BizException("KB-400", "startChunkSec invalid");
        }
        if (safeSize < 1 || safeSize > MAX_CHUNK_PAGE_SIZE) {
            throw new BizException("KB-400", "size invalid");
        }

        KbDoc doc = support.requireDocByDocId(normalizedDocId);
        support.ensureDocAccess(doc, userId);
        CachedValue<KbDocTextChunkPage> cached = kbDocQueryCache.getChunks(
                normalizedProjectId, normalizedDocId, safeStartChunkSec, safeSize, userId
        );
        if (cached.isHit() && cached.getValue() != null) {
            return cached.getValue();
        }
        List<KbDocTextChunk> fetched = docRepository.findTextChunksByDocInternalId(
                doc.getId(), safeStartChunkSec, safeSize + 1);
        boolean hasMore = fetched.size() > safeSize;
        List<KbDocTextChunk> items = hasMore ? List.copyOf(fetched.subList(0, safeSize)) : List.copyOf(fetched);
        Integer nextChunkSec = hasMore ? fetched.get(safeSize).getChunkSec() : null;
        KbDocTextChunkPage result = new KbDocTextChunkPage(items, hasMore, nextChunkSec);
        kbDocQueryCache.putChunks(normalizedProjectId, normalizedDocId, safeStartChunkSec, safeSize, userId, result);
        return result;
    }
}

