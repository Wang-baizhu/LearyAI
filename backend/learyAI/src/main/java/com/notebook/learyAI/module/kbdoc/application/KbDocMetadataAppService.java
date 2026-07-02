// Responsibility: Handle kb doc editable metadata update use cases.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class KbDocMetadataAppService {
    private final KbDocRepository docRepository;
    private final KbDocAppSupport support;
    private final KbDocQueryCache kbDocQueryCache;

    public KbDocMetadataAppService(KbDocRepository docRepository,
                                   KbDocAppSupport support,
                                   KbDocQueryCache kbDocQueryCache) {
        this.docRepository = docRepository;
        this.support = support;
        this.kbDocQueryCache = kbDocQueryCache;
    }

    @Transactional
    public KbDoc updateDetail(String projectId, String docId, String name, String description, Map<String, Object> documentation) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        support.requireWriteRole(normalizedProjectId, userId);
        String normalizedDocId = support.normalizeRequired(docId, "docId");
        String normalizedName = support.normalizeRequired(name, "name");
        String normalizedDescription = support.normalizeOptional(description);
        Map<String, Object> normalizedDocumentation = normalizeDocumentation(documentation);

        KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new com.notebook.learyAI.shared.exception.BizException("KB-404", "doc not found"));
        Map<String, Object> metadata = new HashMap<>(doc.getMetadata() == null ? Map.of() : doc.getMetadata());
        rewriteMetadataField(metadata, "description", normalizedDescription);
        rewriteMetadataField(metadata, "documentation", normalizedDocumentation);
        KbDoc updated = docRepository.updateDetailByDocId(
                normalizedProjectId,
                normalizedDocId,
                normalizedName,
                support.writeMetadata(metadata)
        );
        kbDocQueryCache.evictDoc(normalizedProjectId, updated.getId(), updated.getDocId());
        return updated;
    }

    private Map<String, Object> normalizeDocumentation(Map<String, Object> documentation) {
        if (documentation == null) {
            return null;
        }
        Object nodes = documentation.get("nodes");
        if (!(nodes instanceof List<?> nodeList)) {
            throw new BizException("KB-400", "documentation.nodes required");
        }
        Map<String, Object> normalized = new HashMap<>(documentation);
        Object version = normalized.get("version");
        normalized.put("version", version instanceof Number ? ((Number) version).intValue() : 1);
        normalized.put("nodes", normalizeDocumentationNodes(nodeList, "documentation.nodes"));
        return normalized;
    }

    private List<Map<String, Object>> normalizeDocumentationNodes(List<?> nodes, String path) {
        return nodes.stream()
                .map(node -> normalizeDocumentationNode(node, path))
                .toList();
    }

    private Map<String, Object> normalizeDocumentationNode(Object value, String path) {
        if (!(value instanceof Map<?, ?> rawNode)) {
            throw new BizException("KB-400", path + " item invalid");
        }
        String id = normalizeOptionalText(rawNode.get("id"));
        String title = normalizeOptionalText(rawNode.get("title"));
        String summary = normalizeOptionalText(rawNode.get("summary"));
        Integer pageStart = toRequiredInteger(rawNode.get("page_start"), path + ".page_start");
        Integer pageEnd = toRequiredInteger(rawNode.get("page_end"), path + ".page_end");
        if (id == null) {
            throw new BizException("KB-400", path + ".id required");
        }
        if (title == null) {
            throw new BizException("KB-400", path + ".title required");
        }
        if (summary == null) {
            throw new BizException("KB-400", path + ".summary required");
        }
        if (pageStart > pageEnd) {
            throw new BizException("KB-400", path + " page range invalid");
        }
        Object children = rawNode.get("children");
        if (!(children instanceof List<?> childList)) {
            throw new BizException("KB-400", path + ".children invalid");
        }
        Map<String, Object> normalized = new HashMap<>();
        normalized.put("id", id);
        normalized.put("title", title);
        normalized.put("summary", summary);
        normalized.put("page_start", pageStart);
        normalized.put("page_end", pageEnd);
        normalized.put("children", normalizeDocumentationNodes(childList, path + ".children"));
        return normalized;
    }

    private String normalizeOptionalText(Object value) {
        if (value == null) {
            return null;
        }
        String trimmed = String.valueOf(value).trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private Integer toRequiredInteger(Object value, String field) {
        if (!(value instanceof Number number)) {
            throw new BizException("KB-400", field + " required");
        }
        return number.intValue();
    }

    private void rewriteMetadataField(Map<String, Object> metadata, String key, Object value) {
        if (value == null) {
            metadata.remove(key);
            return;
        }
        metadata.put(key, value);
    }
}
