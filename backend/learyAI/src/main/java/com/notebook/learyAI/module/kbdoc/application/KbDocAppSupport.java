// Responsibility: Provide shared helpers for kb doc application services.
package com.notebook.learyAI.module.kbdoc.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kb.application.KnowledgeBaseAccessSupport;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocRelation;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.storage.TemporaryUrlPurpose;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Locale;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class KbDocAppSupport {
    private final KbDocRepository docRepository;
    private final KbDocRelationRepository relationRepository;
    private final KnowledgeBaseRepository knowledgeBaseRepository;
    private final KnowledgeBaseAccessSupport accessSupport;
    private final StorageClient storageClient;
    private final ObjectMapper objectMapper;
    private final AuthzSdk authzSdk;
    private final String storageProvider;

    public KbDocAppSupport(KbDocRepository docRepository,
                           KbDocRelationRepository relationRepository,
                           KnowledgeBaseRepository knowledgeBaseRepository,
                           KnowledgeBaseAccessSupport accessSupport,
                           StorageClient storageClient,
                           ObjectMapper objectMapper,
                           AuthzSdk authzSdk,
                           @Value("${kb.storage.provider:minio-stub}") String storageProvider) {
        this.docRepository = docRepository;
        this.relationRepository = relationRepository;
        this.knowledgeBaseRepository = knowledgeBaseRepository;
        this.accessSupport = accessSupport;
        this.storageClient = storageClient;
        this.objectMapper = objectMapper;
        this.authzSdk = authzSdk;
        this.storageProvider = storageProvider;
    }

    public Long requireUserId() {
        return authzSdk.requireUserId();
    }

    public String normalizeRequired(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", field + " required");
        }
        return value.trim();
    }

    public String normalizeOptional(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public String normalizeKbId(String kbId) {
        return parseKbId(kbId).toString();
    }

    public void requireHttpUrl(String url) {
        String normalizedUrl = normalizeRequired(url, "url");
        try {
            URI uri = new URI(normalizedUrl);
            String scheme = uri.getScheme();
            if (!"http".equalsIgnoreCase(scheme) && !"https".equalsIgnoreCase(scheme)) {
                throw new BizException("KB-400", "url invalid");
            }
            if (uri.getHost() == null || uri.getHost().isBlank()) {
                throw new BizException("KB-400", "url invalid");
            }
        } catch (URISyntaxException ex) {
            throw new BizException("KB-400", "url invalid");
        }
    }

    public String requireSupportedMediaUrl(String url) {
        String normalizedUrl = normalizeRequired(url, "url");
        try {
            URI uri = new URI(normalizedUrl);
            String scheme = normalizeOptional(uri.getScheme());
            String host = normalizeOptional(uri.getHost());
            String path = normalizeOptional(uri.getPath());
            if (!"https".equalsIgnoreCase(scheme)) {
                throw new BizException("KB-400", "仅支持 https://www.bilibili.com/video 开头的链接");
            }
            if (!"www.bilibili.com".equalsIgnoreCase(host)) {
                throw new BizException("KB-400", "仅支持 https://www.bilibili.com/video 开头的链接");
            }
            String normalizedPath = path == null ? "" : path.toLowerCase(Locale.ROOT);
            if (!normalizedPath.startsWith("/video")) {
                throw new BizException("KB-400", "仅支持 https://www.bilibili.com/video 开头的链接");
            }
            return normalizedUrl;
        } catch (URISyntaxException ex) {
            throw new BizException("KB-400", "url invalid");
        }
    }

    public UUID parseKbId(String kbId) {
        try {
            return UUID.fromString(kbId.trim());
        } catch (IllegalArgumentException ex) {
            throw new BizException("KB-400", "kbId invalid");
        }
    }

    public String requireProjectId(String projectId) {
        return authzSdk.requireProjectId(projectId, "KB-400", "KB-400", "KB-404");
    }

    public void requireMember(String projectId, Long userId) {
        requireRole(projectId, userId);
    }

    public boolean isMember(String projectId, Long userId) {
        return authzSdk.isMember(userId, projectId);
    }

    public ProjectRole requireRole(String projectId, Long userId) {
        try {
            return authzSdk.requireRole(userId, projectId, java.util.Set.of(
                    ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER));
        } catch (BizException ex) {
            if ("PROJECT-403".equals(ex.getCode())) {
                throw new BizException("KB-403", "project access denied");
            }
            throw ex;
        }
    }

    public ProjectRole requireWriteRole(String projectId, Long userId) {
        ProjectRole role = requireRole(projectId, userId);
        if (role != ProjectRole.OWNER && role != ProjectRole.ADMIN) {
            throw new BizException("KB-403", "permission denied");
        }
        return role;
    }

    public String writeMetadata(Map<String, Object> metadata) {
        if (metadata == null || metadata.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "metadata serialize failed");
        }
    }

    public Map<String, Object> readMetadata(String raw) {
        if (raw == null || raw.isBlank()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "metadata parse failed");
        }
    }

    public String asString(Object value) {
        if (value == null) {
            return null;
        }
        return String.valueOf(value);
    }

    public Long asLong(Object value) {
        if (value == null) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).longValue();
        }
        try {
            return Long.parseLong(String.valueOf(value));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public TemporaryUrlPurpose resolvePurpose(String purpose) {
        if (purpose == null || purpose.isBlank()) {
            return TemporaryUrlPurpose.UPLOAD;
        }
        try {
            return TemporaryUrlPurpose.valueOf(purpose.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BizException("KB-400", "purpose invalid");
        }
    }

    public TemporaryUrlPurpose resolvePurpose(String purpose, Set<TemporaryUrlPurpose> allowedPurposes) {
        TemporaryUrlPurpose resolvedPurpose = resolvePurpose(purpose);
        if (!allowedPurposes.contains(resolvedPurpose)) {
            throw new BizException("KB-400", "purpose invalid");
        }
        return resolvedPurpose;
    }

    public String buildObjectKey(Long userId, String docId, String fileType) {
        String normalizedUserId = String.valueOf(requirePositiveUserId(userId));
        String normalizedDocId = normalizeRequired(docId, "docId");
        String suffix = fileType == null || fileType.isBlank() ? "bin" : fileType.trim();
        return "kb/docs/user/" + normalizedUserId + "/" + normalizedDocId + "/" + UUID.randomUUID() + "." + suffix;
    }

    public String buildUserPrefix(Long userId) {
        String normalizedUserId = String.valueOf(requirePositiveUserId(userId));
        return "kb/docs/user/" + normalizedUserId + "/";
    }

    public String buildDocPrefix(String docId) {
        String normalizedDocId = normalizeRequired(docId, "docId");
        return "kb/docs/" + normalizedDocId + "/";
    }

    public String buildObjectPrefix(String objectKey) {
        String normalizedObjectKey = normalizeRequired(objectKey, "objectKey");
        int index = normalizedObjectKey.lastIndexOf('/');
        if (index < 0) {
            return normalizedObjectKey + "/";
        }
        return normalizedObjectKey.substring(0, index + 1);
    }

    public String buildDocName(String docId, String fileType, String sourceName) {
        String normalizedSourceName = normalizeOptional(sourceName);
        if (normalizedSourceName != null) {
            return normalizedSourceName;
        }
        if (docId == null) {
            return "doc";
        }
        String trimmed = docId.trim();
        if (fileType == null || fileType.isBlank()) {
            return trimmed;
        }
        return trimmed + "." + fileType.trim();
    }

    public String buildSupportedMediaDocName(String url, String explicitName) {
        String normalizedExplicitName = normalizeOptional(explicitName);
        if (normalizedExplicitName != null) {
            return normalizedExplicitName;
        }
        String normalizedUrl = requireSupportedMediaUrl(url);
        try {
            URI uri = new URI(normalizedUrl);
            String bvid = extractBvid(uri);
            long page = extractPage(uri);
            return "Bili_" + bvid + "_p" + page;
        } catch (URISyntaxException ex) {
            throw new BizException("KB-400", "url invalid");
        }
    }

    public Long requireKbInternalId(String projectId, String kbId, Long userId, boolean requireOwner) {
        KnowledgeBase knowledgeBase = requireKb(kbId, userId, requireOwner);
        return knowledgeBase.getId();
    }

    public KnowledgeBase requireKb(String kbId, Long userId, boolean requireOwner) {
        String normalizedKbId = normalizeKbId(kbId);
        KnowledgeBase knowledgeBase = knowledgeBaseRepository.findByKbId(normalizedKbId)
                .orElseThrow(() -> new BizException("KB-404", "knowledge base not found"));
        if (requireOwner) {
            if (!userId.equals(knowledgeBase.getOwnerId())) {
                throw new BizException("KB-403", "permission denied");
            }
            return knowledgeBase;
        }
        accessSupport.ensureAccess(knowledgeBase, userId);
        return knowledgeBase;
    }

    public KbDoc requireDocByDocId(String docId) {
        String normalizedDocId = normalizeRequired(docId, "docId");
        KbDoc doc = docRepository.findByDocId(normalizedDocId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        if (doc.getProjectId() == null || doc.getProjectId().isBlank()) {
            throw new BizException("KB-404", "doc not found");
        }
        return doc;
    }

    public void ensureDocAccess(KbDoc doc, Long userId) {
        String projectId = doc.getProjectId();
        if (projectId == null || projectId.isBlank()) {
            throw new BizException("KB-404", "doc not found");
        }
        if (isMember(projectId, userId)) {
            return;
        }
        java.util.List<Long> kbIds = relationRepository.findKbIdsByDocId(projectId, doc.getId());
        for (Long kbId : kbIds) {
            Optional<KnowledgeBase> knowledgeBase = knowledgeBaseRepository.findById(kbId, projectId);
            if (knowledgeBase.isEmpty()) {
                continue;
            }
            try {
                accessSupport.ensureAccess(knowledgeBase.get(), userId);
                return;
            } catch (BizException ex) {
                // Try other bindings before failing.
            }
        }
        throw new BizException("KB-404", "doc not found");
    }

    public void addDoc(String projectId, String docId, Map<String, Object> metadata, TaskStatus status, Instant now) {
        Long userId = requireUserId();
        requireMember(projectId, userId);
        Optional<KbDoc> existing = docRepository.findByDocId(docId, projectId);
        if (existing.isPresent()) {
            return;
        }
        String fileType = asString(metadata.get("fileType"));
        String sourceType = asString(metadata.get("sourceType"));
        String source = asString(metadata.get("source"));
        String objectKey = asString(metadata.get("objectKey"));
        if ((objectKey == null || objectKey.isBlank()) && "objectKey".equals(sourceType)) {
            objectKey = source;
        }
        Long size = asLong(metadata.get("size"));
        String originUrl = resolveOriginUrl(sourceType, source, objectKey);
        String sourceName = asString(metadata.get("name"));
        String statusValue = status == null ? null : status.name();
        KbDoc doc = new KbDoc(null, projectId, docId, buildDocName(docId, fileType, sourceName), fileType, size,
                objectKey, storageProvider, originUrl, null, statusValue, now, null);
        docRepository.save(doc);
    }

    public void bindDocInternal(String projectId, Long docId, Long kbId, Long userId) {
        if (relationRepository.exists(projectId, kbId, docId)) {
            return;
        }
        Instant now = Instant.now();
        relationRepository.save(new KbDocRelation(null, projectId, kbId, docId, now));
    }

    private long requirePositiveUserId(Long userId) {
        if (userId == null || userId <= 0) {
            throw new BizException("KB-400", "userId invalid");
        }
        return userId;
    }

    private String extractBvid(URI uri) {
        String path = normalizeOptional(uri.getPath());
        if (path == null) {
            throw new BizException("KB-400", "仅支持 https://www.bilibili.com/video 开头的链接");
        }
        String[] segments = Arrays.stream(path.split("/"))
                .filter(segment -> !segment.isBlank())
                .toArray(String[]::new);
        if (segments.length < 2 || !"video".equalsIgnoreCase(segments[0])) {
            throw new BizException("KB-400", "仅支持 https://www.bilibili.com/video 开头的链接");
        }
        String bvid = normalizeOptional(segments[1]);
        if (bvid == null) {
            throw new BizException("KB-400", "仅支持 https://www.bilibili.com/video 开头的链接");
        }
        return bvid;
    }

    private long extractPage(URI uri) {
        String query = normalizeOptional(uri.getRawQuery());
        if (query == null) {
            return 1L;
        }
        for (String part : query.split("&")) {
            String normalizedPart = normalizeOptional(part);
            if (normalizedPart == null) {
                continue;
            }
            int index = normalizedPart.indexOf('=');
            String key = index >= 0 ? normalizedPart.substring(0, index) : normalizedPart;
            if (!"p".equals(key)) {
                continue;
            }
            String rawValue = index >= 0 ? normalizedPart.substring(index + 1) : "";
            String decodedValue = URLDecoder.decode(rawValue, StandardCharsets.UTF_8);
            if (decodedValue.isBlank()) {
                return 1L;
            }
            try {
                long page = Long.parseLong(decodedValue);
                return page > 0 ? page : 1L;
            } catch (NumberFormatException ex) {
                return 1L;
            }
        }
        return 1L;
    }

    private String resolveOriginUrl(String sourceType, String source, String objectKey) {
        if ("url".equals(sourceType) && source != null && !source.isBlank()) {
            return source;
        }
        if (objectKey != null && !objectKey.isBlank()) {
            return storageClient.buildObjectUrl(objectKey);
        }
        return null;
    }

}
