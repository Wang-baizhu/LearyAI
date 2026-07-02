// Responsibility: Implement kb doc repository using JPA persistence.
package com.notebook.learyAI.module.kbdoc.infrastructure.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunk;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.kbdoc.infrastructure.persistence.jpa.KbDocJpaRepository;
import com.notebook.learyAI.module.kbdoc.infrastructure.persistence.po.KbDocPO;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Repository;

import jakarta.persistence.EntityManager;
import jakarta.persistence.Query;
import jakarta.persistence.TypedQuery;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Repository
public class KbDocRepositoryImpl implements KbDocRepository {
    private final KbDocJpaRepository jpaRepository;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    public KbDocRepositoryImpl(KbDocJpaRepository jpaRepository, EntityManager entityManager,
                               ObjectMapper objectMapper) {
        this.jpaRepository = jpaRepository;
        this.entityManager = entityManager;
        this.objectMapper = objectMapper;
    }

    @Override
    public KbDoc save(KbDoc doc) {
        KbDocPO saved = jpaRepository.save(toPo(doc));
        return toDomain(saved);
    }

    @Override
    public Optional<KbDoc> findById(Long id, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByIdAndProjectId(id, projectUuid).map(this::toDomain);
    }

    @Override
    public Optional<KbDoc> findByDocId(String docId, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByDocIdAndProjectId(docId, projectUuid).map(this::toDomain);
    }

    @Override
    public Optional<KbDoc> findByDocId(String docId) {
        if (docId == null || docId.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findByDocId(docId).map(this::toDomain);
    }

    @Override
    public boolean existsByDocId(String docId, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return false;
        }
        return jpaRepository.existsByDocIdAndProjectId(docId, projectUuid);
    }

    @Override
    public KbDocPage search(String projectId, String search, String fileType, int page, int size, Long kbId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return new KbDocPage(List.of(), 0, page, size);
        }
        StringBuilder base;
        if (kbId == null) {
            base = new StringBuilder(" from KbDocPO doc where doc.projectId = :projectId");
        } else {
            base = new StringBuilder(" from KbDocPO doc, KbDocRelPO rel where doc.projectId = :projectId")
                    .append(" and rel.projectId = :projectId")
                    .append(" and rel.docId = doc.id")
                    .append(" and rel.kbId = :kbId");
        }
        if (search != null) {
            base.append(" and (lower(doc.name) like :search or lower(doc.docId) like :search)");
        }
        if (fileType != null) {
            base.append(" and doc.fileType = :fileType");
        }
        String orderBy = " order by doc.createdAt desc";
        String queryText = "select doc" + base + orderBy;
        String countText = "select count(doc.id)" + base;

        TypedQuery<KbDocPO> query = entityManager.createQuery(queryText, KbDocPO.class);
        query.setParameter("projectId", projectUuid);
        if (kbId != null) {
            query.setParameter("kbId", kbId);
        }
        if (search != null) {
            query.setParameter("search", "%" + search.toLowerCase() + "%");
        }
        if (fileType != null) {
            query.setParameter("fileType", fileType);
        }
        query.setFirstResult((page - 1) * size);
        query.setMaxResults(size);

        TypedQuery<Long> countQuery = entityManager.createQuery(countText, Long.class);
        countQuery.setParameter("projectId", projectUuid);
        if (kbId != null) {
            countQuery.setParameter("kbId", kbId);
        }
        if (search != null) {
            countQuery.setParameter("search", "%" + search.toLowerCase() + "%");
        }
        if (fileType != null) {
            countQuery.setParameter("fileType", fileType);
        }

        List<KbDoc> items = new ArrayList<>();
        for (KbDocPO po : query.getResultList()) {
            items.add(toDomain(po));
        }
        long total = countQuery.getSingleResult();
        return new KbDocPage(items, total, page, size);
    }

    @Override
    public List<KbDocOption> findDocOptions(String projectId, String search, Long kbId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return List.of();
        }
        StringBuilder base;
        if (kbId == null) {
            base = new StringBuilder(" from KbDocPO doc where doc.projectId = :projectId");
        } else {
            base = new StringBuilder(" from KbDocPO doc, KbDocRelPO rel where doc.projectId = :projectId")
                    .append(" and rel.projectId = :projectId")
                    .append(" and rel.docId = doc.id")
                    .append(" and rel.kbId = :kbId");
        }
        if (search != null) {
            base.append(" and (lower(doc.name) like :search or lower(doc.docId) like :search)");
        }
        base.append(" order by doc.createdAt desc");
        TypedQuery<Object[]> query = entityManager.createQuery(
                "select doc.docId, doc.name, doc.status" + base,
                Object[].class
        );
        query.setParameter("projectId", projectUuid);
        if (kbId != null) {
            query.setParameter("kbId", kbId);
        }
        if (search != null) {
            query.setParameter("search", "%" + search.toLowerCase() + "%");
        }
        List<KbDocOption> options = new ArrayList<>();
        for (Object[] row : query.getResultList()) {
            String docId = row[0] == null ? null : String.valueOf(row[0]);
            String name = row[1] == null ? null : String.valueOf(row[1]);
            String status = row[2] == null ? null : String.valueOf(row[2]);
            if (docId != null && !docId.isBlank() && name != null && !name.isBlank()) {
                options.add(new KbDocOption(docId, name, status));
            }
        }
        return options;
    }

    @Override
    public List<String> findRecentDocIds(String projectId, int limit) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return List.of();
        }
        TypedQuery<String> query = entityManager.createQuery(
                "select doc.docId from KbDocPO doc where doc.projectId = :projectId order by doc.createdAt desc",
                String.class);
        query.setParameter("projectId", projectUuid);
        query.setMaxResults(limit);
        return query.getResultList();
    }

    @Override
    public List<KbDocTextChunk> findTextChunksByDocInternalId(Long docInternalId, int startChunkSec, int limit) {
        Query query = entityManager.createNativeQuery(
                "select page_num, text, store_key from (" +
                        " select page_num, text, 'zh' as store_key from kb_chunk_zh" +
                        " where doc_id = :docId and page_num is not null and page_num >= :startChunkSec" +
                        " union all" +
                        " select page_num, text, 'en' as store_key from kb_chunk_en" +
                        " where doc_id = :docId and page_num is not null and page_num >= :startChunkSec" +
                        ") chunks order by page_num asc");
        query.setParameter("docId", docInternalId);
        query.setParameter("startChunkSec", startChunkSec);
        query.setMaxResults(limit);
        List<?> rows = query.getResultList();
        List<KbDocTextChunk> chunks = new ArrayList<>();
        Map<Integer, String> pageStoreKeys = new HashMap<>();
        for (Object row : rows) {
            Object[] columns = (Object[]) row;
            Integer chunkSec = columns[0] == null ? null : ((Number) columns[0]).intValue();
            String text = columns[1] == null ? null : String.valueOf(columns[1]);
            String storeKey = columns[2] == null ? null : String.valueOf(columns[2]);
            if (chunkSec != null) {
                String existingStoreKey = pageStoreKeys.putIfAbsent(chunkSec, storeKey);
                if (existingStoreKey != null && !existingStoreKey.equals(storeKey)) {
                    throw new BizException("KB-500", "doc chunk page routed to multiple stores");
                }
                chunks.add(new KbDocTextChunk(chunkSec, text));
            }
        }
        return chunks;
    }

    @Override
    public void deleteById(Long id, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return;
        }
        jpaRepository.findByIdAndProjectId(id, projectUuid).ifPresent(jpaRepository::delete);
    }

    @Override
    public void deleteByDocId(String docId, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null || docId == null || docId.isBlank()) {
            return;
        }
        jpaRepository.deleteByDocIdAndProjectId(docId, projectUuid);
    }

    @Override
    public void updateStatusByDocId(String projectId, String docId, String status) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null || docId == null || docId.isBlank()) {
            return;
        }
        jpaRepository.findByDocIdAndProjectId(docId, projectUuid).ifPresent(po -> {
            po.setStatus(status);
            jpaRepository.save(po);
        });
    }

    @Override
    public KbDoc updateDetailByDocId(String projectId, String docId, String name, String metadataRaw) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null || docId == null || docId.isBlank()) {
            throw new BizException("KB-404", "doc not found");
        }
        KbDocPO po = jpaRepository.findByDocIdAndProjectId(docId, projectUuid)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        po.setName(name);
        po.setMetadata(metadataRaw);
        return toDomain(jpaRepository.save(po));
    }

    private KbDocPO toPo(KbDoc doc) {
        KbDocPO po = new KbDocPO();
        po.setId(doc.getId());
        if (doc.getProjectId() != null && !doc.getProjectId().isBlank()) {
            po.setProjectId(java.util.UUID.fromString(doc.getProjectId()));
        }
        po.setDocId(doc.getDocId());
        po.setName(doc.getName());
        po.setFileType(doc.getFileType());
        po.setSize(doc.getSize());
        po.setStorageProvider(doc.getStorageProvider());
        po.setStatus(doc.getStatus());
        po.setIdentity(buildIdentity(doc.getObjectKey(), doc.getOriginUrl()));
        po.setMetadata(writeJson(doc.getMetadata()));
        Instant createdAt = doc.getCreatedAt();
        Instant now = Instant.now();
        po.setCreatedAt(createdAt == null ? now : createdAt);
        return po;
    }

    private KbDoc toDomain(KbDocPO po) {
        String projectId = po.getProjectId() == null ? null : po.getProjectId().toString();
        IdentityData identityData = parseIdentity(po.getIdentity());
        Map<String, Object> metadata = readJsonMap(po.getMetadata());
        return new KbDoc(po.getId(), projectId, po.getDocId(), po.getName(), po.getFileType(),
                po.getSize(), identityData.objectKey, po.getStorageProvider(), identityData.originUrl, metadata,
                po.getStatus(), po.getCreatedAt(), null);
    }

    private String buildIdentity(String objectKey, String originUrl) {
        Map<String, Object> identity = new HashMap<>();
        if (objectKey != null && !objectKey.isBlank()) {
            identity.put("object_key", objectKey);
        }
        if (originUrl != null && !originUrl.isBlank()) {
            identity.put("origin_url", originUrl);
        }
        if (identity.isEmpty()) {
            return null;
        }
        return writeJson(identity);
    }

    private IdentityData parseIdentity(String identityRaw) {
        Map<String, Object> identity = readJsonMap(identityRaw);
        if (identity == null || identity.isEmpty()) {
            return new IdentityData(null, null);
        }
        String objectKey = asString(identity.get("object_key"));
        String originUrl = asString(identity.get("origin_url"));
        return new IdentityData(objectKey, originUrl);
    }

    private Map<String, Object> readJsonMap(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String writeJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }
        return String.valueOf(value);
    }

    private static class IdentityData {
        private final String objectKey;
        private final String originUrl;

        private IdentityData(String objectKey, String originUrl) {
            this.objectKey = objectKey;
            this.originUrl = originUrl;
        }
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
}
