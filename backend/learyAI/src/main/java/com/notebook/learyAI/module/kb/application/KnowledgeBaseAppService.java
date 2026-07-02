// Responsibility: Handle knowledge base use cases.
package com.notebook.learyAI.module.kb.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.kb.application.cache.CachedValue;
import com.notebook.learyAI.module.kb.application.cache.KnowledgeBaseQueryCache;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kb.domain.service.KnowledgeBaseDomainService;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.visit.application.UserResourceVisitAppService;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class KnowledgeBaseAppService {
    private static final int MAX_PAGE_SIZE = 100;

    private final KnowledgeBaseRepository repository;
    private final KbDocRelationRepository relationRepository;
    private final KbDocRepository docRepository;
    private final UserResourceVisitAppService visitAppService;
    private final KnowledgeBaseAccessSupport accessSupport;
    private final KnowledgeBaseDomainService domainService;
    private final AuthzSdk authzSdk;
    private final KnowledgeBaseQueryCache knowledgeBaseQueryCache;
    @Autowired
    public KnowledgeBaseAppService(KnowledgeBaseRepository repository,
                                   KbDocRelationRepository relationRepository,
                                   KbDocRepository docRepository,
                                   UserResourceVisitAppService visitAppService,
                                   KnowledgeBaseAccessSupport accessSupport,
                                   KnowledgeBaseDomainService domainService,
                                   AuthzSdk authzSdk,
                                   KnowledgeBaseQueryCache knowledgeBaseQueryCache) {
        this.repository = repository;
        this.relationRepository = relationRepository;
        this.docRepository = docRepository;
        this.visitAppService = visitAppService;
        this.accessSupport = accessSupport;
        this.domainService = domainService;
        this.authzSdk = authzSdk;
        this.knowledgeBaseQueryCache = knowledgeBaseQueryCache;
    }

    public KnowledgeBasePage list(String projectId, String search, String tag, String sort, String order,
                                  Integer page, Integer size) {
        int safePage = page == null ? 1 : page;
        int safeSize = size == null ? 20 : size;
        if (safePage < 1 || safeSize < 1 || safeSize > MAX_PAGE_SIZE) {
            throw new BizException("KB-400", "invalid pagination");
        }
        String normalizedProjectId = requireProjectId(projectId);
        String normalizedSearch = normalizeOptional(search);
        String normalizedTag = normalizeOptional(tag);
        KnowledgeBaseSort sortField = KnowledgeBaseSort.from(sort);
        boolean desc = order == null || !"asc".equalsIgnoreCase(order);
        Long userId = requireUserId();
        boolean isMember = authzSdk.isMember(userId, normalizedProjectId);
        CachedValue<KnowledgeBasePage> cached = knowledgeBaseQueryCache.getList(
                normalizedProjectId, userId, isMember, normalizedSearch, normalizedTag, sortField, desc, safePage, safeSize
        );
        if (cached.isHit() && cached.getValue() != null) {
            return cached.getValue();
        }
        KnowledgeBasePage pageResult = repository.search(normalizedProjectId, userId, isMember, normalizedSearch, normalizedTag, sortField,
                desc, safePage, safeSize);
        knowledgeBaseQueryCache.putList(
                normalizedProjectId, userId, isMember, normalizedSearch, normalizedTag, sortField, desc, safePage, safeSize, pageResult
        );
        return pageResult;
    }

    public KnowledgeBase getByKbId(String projectId, String kbId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        String normalizedKbId = normalizeKbId(kbId);
        CachedValue<KnowledgeBase> cached = knowledgeBaseQueryCache.getDetail(normalizedProjectId, normalizedKbId, userId);
        KnowledgeBase knowledgeBase;
        if (cached.isHit() && cached.getValue() != null) {
            knowledgeBase = cached.getValue();
            accessSupport.ensureAccess(knowledgeBase, userId);
        } else {
            knowledgeBase = repository.findByKbId(normalizedKbId, normalizedProjectId)
                    .orElseThrow(() -> new BizException("KB-404", "knowledge base not found"));
            accessSupport.ensureAccess(knowledgeBase, userId);
            knowledgeBaseQueryCache.putDetail(normalizedProjectId, normalizedKbId, userId, knowledgeBase);
        }
        Instant now = Instant.now();
        visitAppService.recordVisit(userId, UserResourceType.PROJECT, normalizedProjectId, now);
        if (knowledgeBase.getKbId() != null) {
            visitAppService.recordVisit(userId, UserResourceType.KB, knowledgeBase.getKbId(), now);
        }
        knowledgeBaseQueryCache.evictRecent(normalizedProjectId, userId);
        return knowledgeBase;
    }

    @Transactional
    public KnowledgeBase create(String projectId, String name, String description, List<String> tags,
                                KnowledgeBaseVisibility visibility) {
        Long resolvedUserId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        ProjectRole role = requireMember(normalizedProjectId, resolvedUserId);
        domainService.requireAdminOrOwner(role);
        String normalizedName = domainService.normalizeName(name);
        String normalizedDescription = domainService.normalizeDescription(description);
        List<String> normalizedTags = domainService.normalizeTags(tags);
        if (repository.existsByNameAndProjectId(normalizedName, normalizedProjectId)) {
            throw new BizException("KB-409", "knowledge base name exists");
        }
        KnowledgeBaseVisibility resolvedVisibility = visibility == null ? KnowledgeBaseVisibility.PRIVATE : visibility;
        KnowledgeBase knowledgeBase = new KnowledgeBase(null, UUID.randomUUID().toString(), normalizedProjectId,
                normalizedName, normalizedDescription, normalizedTags, resolvedUserId, resolvedVisibility, null,
                Map.of());
        KnowledgeBase created = repository.save(knowledgeBase);
        knowledgeBaseQueryCache.evictByProject(normalizedProjectId);
        return created;
    }

    public KnowledgeBase create(String projectId, String name, String description, List<String> tags,
                                KnowledgeBaseVisibility visibility, List<String> enabledTemplatePluginIds) {
        return create(projectId, name, description, tags, visibility);
    }

    @Transactional
    public KnowledgeBase update(String projectId, String kbId, String name, String description, List<String> tags,
                                KnowledgeBaseVisibility visibility) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        String normalizedKbId = normalizeKbId(kbId);
        KnowledgeBase existing = repository.findByKbId(normalizedKbId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "knowledge base not found"));
        domainService.requireOwner(existing, userId);
        String updatedName = name == null ? existing.getName() : domainService.normalizeName(name);
        String updatedDescription = description == null ? existing.getDescription() : domainService.normalizeDescription(description);
        List<String> updatedTags = tags == null ? existing.getTags() : domainService.normalizeTags(tags);
        if (!updatedName.equals(existing.getName())
                && repository.existsByNameAndProjectId(updatedName, normalizedProjectId)) {
            throw new BizException("KB-409", "knowledge base name exists");
        }
        KnowledgeBase updated = existing.withUpdated(updatedName, updatedDescription, updatedTags);
        if (visibility != null && visibility != existing.getVisibility()) {
            updated = updated.withVisibility(visibility);
        }
        KnowledgeBase saved = repository.save(updated);
        knowledgeBaseQueryCache.evictByProject(normalizedProjectId);
        return saved;
    }

    public KnowledgeBase update(String projectId, String kbId, String name, String description, List<String> tags,
                                KnowledgeBaseVisibility visibility, List<String> enabledTemplatePluginIds) {
        return update(projectId, kbId, name, description, tags, visibility);
    }

    public Map<String, Object> getCanvas(String projectId, String kbId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        String normalizedKbId = normalizeKbId(kbId);
        KnowledgeBase existing = repository.findByKbId(normalizedKbId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "knowledge base not found"));
        accessSupport.ensureAccess(existing, userId);
        return existing.getCanvas();
    }

    @Transactional
    public Map<String, Object> updateCanvas(String projectId, String kbId, Map<String, Object> canvas) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        String normalizedKbId = normalizeKbId(kbId);
        KnowledgeBase existing = repository.findByKbId(normalizedKbId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "knowledge base not found"));
        domainService.requireOwner(existing, userId);
        Map<String, Object> normalizedCanvas = canvas == null ? Map.of() : new java.util.HashMap<>(canvas);
        repository.updateCanvas(existing.getId(), normalizedCanvas);
        knowledgeBaseQueryCache.evictByProject(normalizedProjectId);
        return normalizedCanvas;
    }

    @Transactional
    public void delete(String projectId, String kbId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        String normalizedKbId = normalizeKbId(kbId);
        KnowledgeBase existing = repository.findByKbId(normalizedKbId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "knowledge base not found"));
        domainService.requireOwner(existing, userId);
        deleteInternal(normalizedProjectId, existing.getId());
        knowledgeBaseQueryCache.evictByProject(normalizedProjectId);
    }

    @Transactional
    public void deleteByProject(String projectId) {
        String normalizedProjectId = requireProjectId(projectId);
        List<Long> kbIds = repository.findIdsByProjectId(normalizedProjectId);
        for (Long kbId : kbIds) {
            deleteInternal(normalizedProjectId, kbId);
        }
        knowledgeBaseQueryCache.evictByProject(normalizedProjectId);
    }

    public List<KnowledgeBase> listRecent(String projectId, Integer limit) {
        int safeLimit = limit == null ? 10 : limit;
        if (safeLimit < 1 || safeLimit > 50) {
            throw new BizException("KB-400", "invalid limit");
        }
        String normalizedProjectId = requireProjectId(projectId);
        Long userId = requireUserId();
        boolean isMember = authzSdk.isMember(userId, normalizedProjectId);
        CachedValue<List<KnowledgeBase>> cached = knowledgeBaseQueryCache.getRecent(normalizedProjectId, userId, safeLimit);
        if (cached.isHit() && cached.getValue() != null) {
            return cached.getValue();
        }
        List<String> recentKbIds = visitAppService.listRecentResourceIds(userId, UserResourceType.KB, safeLimit);
        if (recentKbIds.isEmpty()) {
            knowledgeBaseQueryCache.putRecent(normalizedProjectId, userId, safeLimit, List.of());
            return List.of();
        }
        List<KnowledgeBase> items = repository.findByKbIds(normalizedProjectId, userId, isMember, recentKbIds);
        if (items.isEmpty()) {
            knowledgeBaseQueryCache.putRecent(normalizedProjectId, userId, safeLimit, List.of());
            return List.of();
        }
        java.util.Map<String, KnowledgeBase> kbById = items.stream()
                .filter(kb -> kb.getKbId() != null && !kb.getKbId().isBlank())
                .collect(java.util.stream.Collectors.toMap(KnowledgeBase::getKbId, kb -> kb, (a, b) -> a));
        List<KnowledgeBase> ordered = new ArrayList<>();
        for (String kbId : recentKbIds) {
            KnowledgeBase kb = kbById.get(kbId);
            if (kb != null) {
                ordered.add(kb);
            }
        }
        knowledgeBaseQueryCache.putRecent(normalizedProjectId, userId, safeLimit, ordered);
        return ordered;
    }

    @Transactional
    public void recordVisit(String projectId, String kbId, Instant visitedAt) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        String normalizedKbId = normalizeKbId(kbId);
        KnowledgeBase existing = repository.findByKbId(normalizedKbId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "knowledge base not found"));
        accessSupport.ensureAccess(existing, userId);
        Instant time = visitedAt == null ? Instant.now() : visitedAt;
        repository.updateVisitedAt(existing.getId(), time);
        visitAppService.recordVisit(userId, UserResourceType.PROJECT, normalizedProjectId, time);
        if (existing.getKbId() != null) {
            visitAppService.recordVisit(userId, UserResourceType.KB, existing.getKbId(), time);
        }
        knowledgeBaseQueryCache.evictRecent(normalizedProjectId, userId);
    }

    private Long requireUserId() {
        return authzSdk.requireUserId();
    }

    private String requireProjectId(String projectId) {
        return authzSdk.requireProjectId(projectId, "KB-400", "KB-400", "KB-404");
    }

    private ProjectRole requireMember(String projectId, Long userId) {
        try {
            return authzSdk.requireRole(userId, projectId, Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER));
        } catch (BizException ex) {
            if ("PROJECT-403".equals(ex.getCode())) {
                throw new BizException("KB-403", "project access denied");
            }
            throw ex;
        }
    }
    private void deleteInternal(String projectId, Long kbId) {
        repository.findById(kbId, projectId)
                .map(KnowledgeBase::getKbId)
                .filter(id -> id != null && !id.isBlank())
                .ifPresent(resourceId -> visitAppService.deleteByResource(UserResourceType.KB, resourceId));
        List<Long> docIds = relationRepository.findDocIdsByKbId(projectId, kbId);
        relationRepository.deleteByKbId(projectId, kbId);
        for (Long docId : docIds) {
            if (relationRepository.countByDocId(projectId, docId) == 0) {
                docRepository.findById(docId, projectId)
                        .ifPresent(doc -> docRepository.deleteById(doc.getId(), projectId));
            }
        }
        repository.deleteById(kbId);
    }

    private String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String normalizeKbId(String kbId) {
        if (kbId == null || kbId.isBlank()) {
            throw new BizException("KB-400", "kbId required");
        }
        try {
            return UUID.fromString(kbId.trim()).toString();
        } catch (IllegalArgumentException ex) {
            throw new BizException("KB-400", "kbId invalid");
        }
    }

}
