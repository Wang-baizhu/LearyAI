// Responsibility: Implement knowledge base repository using JPA persistence.
package com.notebook.learyAI.module.kb.infrastructure.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kb.infrastructure.persistence.jpa.KnowledgeBaseJpaRepository;
import com.notebook.learyAI.module.kb.infrastructure.persistence.po.KnowledgeBasePO;
import org.springframework.stereotype.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class KnowledgeBaseRepositoryImpl implements KnowledgeBaseRepository {
    private static final String TAG_DELIMITER = ",";

    private final KnowledgeBaseJpaRepository jpaRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public KnowledgeBaseRepositoryImpl(KnowledgeBaseJpaRepository jpaRepository, EntityManager entityManager,
                                       ObjectMapper objectMapper) {
        this.jpaRepository = jpaRepository;
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
    }

    @Override
    public KnowledgeBase save(KnowledgeBase knowledgeBase) {
        KnowledgeBasePO saved = jpaRepository.save(toPo(knowledgeBase));
        return toDomain(saved);
    }

    @Override
    public Optional<KnowledgeBase> findById(Long id, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByIdAndProjectId(id, projectUuid).map(this::toDomain);
    }

    @Override
    public Optional<KnowledgeBase> findByKbId(String kbId, String projectId) {
        java.util.UUID kbUuid = parseUuid(kbId);
        java.util.UUID projectUuid = parseUuid(projectId);
        if (kbUuid == null || projectUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByKbIdAndProjectId(kbUuid, projectUuid).map(this::toDomain);
    }

    @Override
    public Optional<KnowledgeBase> findByKbId(String kbId) {
        java.util.UUID kbUuid = parseUuid(kbId);
        if (kbUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByKbId(kbUuid).map(this::toDomain);
    }

    @Override
    public boolean existsByNameAndProjectId(String name, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return false;
        }
        return jpaRepository.existsByNameAndProjectId(name, projectUuid);
    }

    @Override
    public KnowledgeBasePage search(String projectId, Long userId, boolean isMember, String search, String tag,
                                    KnowledgeBaseSort sort, boolean desc, int page, int size) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return new KnowledgeBasePage(List.of(), 0, page, size);
        }
        StringBuilder base = new StringBuilder(" from KnowledgeBasePO kb where kb.projectId = :projectId");
        base.append(" and (kb.visibility = :publicVisibility");
        if (isMember) {
            base.append(" or kb.visibility = :teamVisibility");
        }
        base.append(" or (kb.visibility = :privateVisibility and kb.ownerId = :ownerId))");
        if (search != null) {
            base.append(" and (lower(kb.name) like :search or lower(kb.description) like :search)");
        }
        if (tag != null) {
            base.append(" and kb.tags like :tag");
        }
        String orderBy = " order by kb." + sort.getProperty() + (desc ? " desc" : " asc");
        String queryText = "select kb" + base + orderBy;
        String countText = "select count(kb.id)" + base;

        TypedQuery<KnowledgeBasePO> query = entityManager.createQuery(queryText, KnowledgeBasePO.class);
        query.setParameter("projectId", projectUuid);
        query.setParameter("publicVisibility", KnowledgeBaseVisibility.PUBLIC.name());
        query.setParameter("privateVisibility", KnowledgeBaseVisibility.PRIVATE.name());
        query.setParameter("ownerId", userId);
        if (isMember) {
            query.setParameter("teamVisibility", KnowledgeBaseVisibility.TEAM.name());
        }
        if (search != null) {
            query.setParameter("search", "%" + search.toLowerCase() + "%");
        }
        if (tag != null) {
            query.setParameter("tag", "%," + tag + ",%");
        }
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery(countText, Long.class);
        countQuery.setParameter("projectId", projectUuid);
        countQuery.setParameter("publicVisibility", KnowledgeBaseVisibility.PUBLIC.name());
        countQuery.setParameter("privateVisibility", KnowledgeBaseVisibility.PRIVATE.name());
        countQuery.setParameter("ownerId", userId);
        if (isMember) {
            countQuery.setParameter("teamVisibility", KnowledgeBaseVisibility.TEAM.name());
        }
        if (search != null) {
            countQuery.setParameter("search", "%" + search.toLowerCase() + "%");
        }
        if (tag != null) {
            countQuery.setParameter("tag", "%," + tag + ",%");
        }

        List<KnowledgeBase> items = new ArrayList<>();
        for (KnowledgeBasePO po : query.getResultList()) {
            items.add(toDomain(po));
        }
        long total = countQuery.getSingleResult();
        return new KnowledgeBasePage(items, total, page, size);
    }

    @Override
    public List<KnowledgeBase> findRecent(String projectId, Long userId, boolean isMember, int limit) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return List.of();
        }
        TypedQuery<KnowledgeBasePO> query = entityManager.createQuery(
                "select kb from KnowledgeBasePO kb where kb.projectId = :projectId"
                        + " and (kb.visibility = :publicVisibility"
                        + (isMember ? " or kb.visibility = :teamVisibility" : "")
                        + " or (kb.visibility = :privateVisibility and kb.ownerId = :ownerId))"
                        + " order by kb.visitedAt desc",
                KnowledgeBasePO.class);
        query.setParameter("projectId", projectUuid);
        query.setParameter("publicVisibility", KnowledgeBaseVisibility.PUBLIC.name());
        query.setParameter("privateVisibility", KnowledgeBaseVisibility.PRIVATE.name());
        query.setParameter("ownerId", userId);
        if (isMember) {
            query.setParameter("teamVisibility", KnowledgeBaseVisibility.TEAM.name());
        }
        query.setMaxResults(limit);
        List<KnowledgeBase> items = new ArrayList<>();
        for (KnowledgeBasePO po : query.getResultList()) {
            items.add(toDomain(po));
        }
        return items;
    }

    @Override
    public KnowledgeBasePage findByOwnerId(Long ownerId, String search, int page, int size) {
        if (ownerId == null) {
            return new KnowledgeBasePage(List.of(), 0, page, size);
        }
        int safePage = Math.max(page, 1);
        String normalizedSearch = search == null || search.isBlank() ? null : search.trim().toLowerCase();
        StringBuilder base = new StringBuilder(" from KnowledgeBasePO kb where kb.ownerId = :ownerId");
        if (normalizedSearch != null) {
            base.append(" and (lower(kb.name) like :search or lower(kb.description) like :search)");
        }
        TypedQuery<KnowledgeBasePO> query = entityManager.createQuery(
                "select kb" + base + " order by kb.visitedAt desc nulls last, kb.id desc",
                KnowledgeBasePO.class);
        query.setParameter("ownerId", ownerId);
        if (normalizedSearch != null) {
            query.setParameter("search", "%" + normalizedSearch + "%");
        }
        query.setFirstResult((safePage - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery("select count(kb.id)" + base, Long.class);
        countQuery.setParameter("ownerId", ownerId);
        if (normalizedSearch != null) {
            countQuery.setParameter("search", "%" + normalizedSearch + "%");
        }

        List<KnowledgeBase> items = new ArrayList<>();
        for (KnowledgeBasePO po : query.getResultList()) {
            items.add(toDomain(po));
        }
        return new KnowledgeBasePage(items, countQuery.getSingleResult(), safePage, size);
    }

    @Override
    public List<KnowledgeBase> findByKbIds(String projectId, Long userId, boolean isMember, List<String> kbIds) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null || kbIds == null || kbIds.isEmpty()) {
            return List.of();
        }
        List<java.util.UUID> kbUuids = new ArrayList<>();
        for (String kbId : kbIds) {
            java.util.UUID kbUuid = parseUuid(kbId);
            if (kbUuid != null) {
                kbUuids.add(kbUuid);
            }
        }
        if (kbUuids.isEmpty()) {
            return List.of();
        }
        String queryText = "select kb from KnowledgeBasePO kb where kb.projectId = :projectId"
                + " and kb.kbId in :kbIds"
                + " and (kb.visibility = :publicVisibility"
                + (isMember ? " or kb.visibility = :teamVisibility" : "")
                + " or (kb.visibility = :privateVisibility and kb.ownerId = :ownerId))";
        TypedQuery<KnowledgeBasePO> query = entityManager.createQuery(queryText, KnowledgeBasePO.class);
        query.setParameter("projectId", projectUuid);
        query.setParameter("kbIds", kbUuids);
        query.setParameter("publicVisibility", KnowledgeBaseVisibility.PUBLIC.name());
        query.setParameter("privateVisibility", KnowledgeBaseVisibility.PRIVATE.name());
        query.setParameter("ownerId", userId);
        if (isMember) {
            query.setParameter("teamVisibility", KnowledgeBaseVisibility.TEAM.name());
        }
        List<KnowledgeBase> items = new ArrayList<>();
        for (KnowledgeBasePO po : query.getResultList()) {
            items.add(toDomain(po));
        }
        return items;
    }

    @Override
    public List<Long> findIdsByProjectId(String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return List.of();
        }
        return entityManager.createQuery(
                "select kb.id from KnowledgeBasePO kb where kb.projectId = :projectId",
                Long.class)
                .setParameter("projectId", projectUuid)
                .getResultList();
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public void updateVisitedAt(Long id, Instant visitedAt) {
        entityManager.createQuery("update KnowledgeBasePO kb set kb.visitedAt = :visitedAt where kb.id = :id")
                .setParameter("visitedAt", visitedAt)
                .setParameter("id", id)
                .executeUpdate();
    }

    @Override
    public void updateCanvas(Long id, Map<String, Object> canvas) {
        entityManager.createQuery("update KnowledgeBasePO kb set kb.canvasJson = :canvasJson where kb.id = :id")
                .setParameter("canvasJson", writeCanvas(canvas))
                .setParameter("id", id)
                .executeUpdate();
    }

    private KnowledgeBasePO toPo(KnowledgeBase knowledgeBase) {
        KnowledgeBasePO po = new KnowledgeBasePO();
        po.setId(knowledgeBase.getId());
        if (knowledgeBase.getKbId() != null && !knowledgeBase.getKbId().isBlank()) {
            po.setKbId(java.util.UUID.fromString(knowledgeBase.getKbId()));
        }
        if (knowledgeBase.getProjectId() != null && !knowledgeBase.getProjectId().isBlank()) {
            po.setProjectId(java.util.UUID.fromString(knowledgeBase.getProjectId()));
        }
        po.setName(knowledgeBase.getName());
        po.setDescription(knowledgeBase.getDescription());
        po.setTags(encodeTags(knowledgeBase.getTags()));
        po.setOwnerId(knowledgeBase.getOwnerId());
        po.setVisibility(knowledgeBase.getVisibility() == null
                ? KnowledgeBaseVisibility.PRIVATE.name()
                : knowledgeBase.getVisibility().name());
        po.setVisitedAt(knowledgeBase.getVisitedAt());
        po.setCanvasJson(writeCanvas(knowledgeBase.getCanvas()));
        po.setEnabledTemplatePluginIdsJson(null);
        return po;
    }

    private KnowledgeBase toDomain(KnowledgeBasePO po) {
        String kbId = po.getKbId() == null ? null : po.getKbId().toString();
        String projectId = po.getProjectId() == null ? null : po.getProjectId().toString();
        KnowledgeBaseVisibility visibility = KnowledgeBaseVisibility.from(po.getVisibility());
        return new KnowledgeBase(po.getId(), kbId, projectId, po.getName(), po.getDescription(),
                decodeTags(po.getTags()), po.getOwnerId(), visibility, po.getVisitedAt(), readCanvas(po.getCanvasJson()));
    }

    private java.util.UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return java.util.UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String encodeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return null;
        }
        StringBuilder builder = new StringBuilder(TAG_DELIMITER);
        for (String tag : tags) {
            builder.append(tag).append(TAG_DELIMITER);
        }
        return builder.toString();
    }

    private List<String> decodeTags(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        String trimmed = raw;
        if (trimmed.startsWith(TAG_DELIMITER)) {
            trimmed = trimmed.substring(1);
        }
        if (trimmed.endsWith(TAG_DELIMITER)) {
            trimmed = trimmed.substring(0, trimmed.length() - 1);
        }
        if (trimmed.isBlank()) {
            return List.of();
        }
        String[] parts = trimmed.split(TAG_DELIMITER);
        List<String> result = new ArrayList<>();
        for (String part : parts) {
            String value = part.trim();
            if (!value.isEmpty()) {
                result.add(value);
            }
        }
        return result;
    }

    private String writeCanvas(Map<String, Object> canvas) {
        if (canvas == null || canvas.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(canvas);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String writeJsonArray(List<String> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private Map<String, Object> readCanvas(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ex) {
            return Map.of();
        }
    }

    private List<String> readStringList(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        try {
            List<String> values = objectMapper.readValue(raw, new TypeReference<List<String>>() {});
            return values == null ? List.of() : List.copyOf(values);
        } catch (JsonProcessingException ex) {
            return List.of();
        }
    }
}
