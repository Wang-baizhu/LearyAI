// Responsibility: Handle knowledge base document binding use cases.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class KbDocBindingAppService {
    private static final String DELETE_REASON_DELETE_BY_DOC_ID = "delete_by_doc_id";
    private static final String DELETE_REASON_UNBIND_LAST_RELATION = "unbind_last_relation";

    private final KbDocRepository docRepository;
    private final KbDocRelationRepository relationRepository;
    private final StorageClient storageClient;
    private final KbDocStorageUsageAppService kbDocStorageUsageAppService;
    private final KbDocAppSupport support;
    private final KbDocQueryCache kbDocQueryCache;

    public KbDocBindingAppService(KbDocRepository docRepository,
                                  KbDocRelationRepository relationRepository,
                                  StorageClient storageClient,
                                  KbDocStorageUsageAppService kbDocStorageUsageAppService,
                                  KbDocAppSupport support,
                                  KbDocQueryCache kbDocQueryCache) {
        this.docRepository = docRepository;
        this.relationRepository = relationRepository;
        this.storageClient = storageClient;
        this.kbDocStorageUsageAppService = kbDocStorageUsageAppService;
        this.support = support;
        this.kbDocQueryCache = kbDocQueryCache;
    }

    @Transactional
    public void deleteByDocId(String projectId, String docId) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        String normalizedDocId = support.normalizeRequired(docId, "docId");
        KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        deleteDocObjects(userId, normalizedProjectId, doc, DELETE_REASON_DELETE_BY_DOC_ID);
        relationRepository.deleteByDocId(normalizedProjectId, doc.getId());
        docRepository.deleteByDocId(normalizedDocId, normalizedProjectId);
        kbDocQueryCache.evictDoc(normalizedProjectId, doc.getId(), doc.getDocId());
    }

    @Transactional
    public void bindDoc(String projectId, String docId, String kbId) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        String normalizedDocId = support.normalizeRequired(docId, "docId");
        String normalizedKbId = support.normalizeRequired(kbId, "kbId");
        Long kbInternalId = support.requireKbInternalId(normalizedProjectId, normalizedKbId, userId, true);
        KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        support.bindDocInternal(normalizedProjectId, doc.getId(), kbInternalId, userId);
        kbDocQueryCache.evictDoc(normalizedProjectId, doc.getId(), doc.getDocId());
    }

    @Transactional
    public void unbindDoc(String projectId, String docId, String kbId) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        String normalizedDocId = support.normalizeRequired(docId, "docId");
        String normalizedKbId = support.normalizeRequired(kbId, "kbId");
        Long kbInternalId = support.requireKbInternalId(normalizedProjectId, normalizedKbId, userId, true);
        KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        relationRepository.delete(normalizedProjectId, kbInternalId, doc.getId());
        long remaining = relationRepository.countByDocId(normalizedProjectId, doc.getId());
        if (remaining == 0) {
            deleteDocObjects(userId, normalizedProjectId, doc, DELETE_REASON_UNBIND_LAST_RELATION);
            docRepository.deleteById(doc.getId(), normalizedProjectId);
        }
        kbDocQueryCache.evictDoc(normalizedProjectId, doc.getId(), doc.getDocId());
    }

    private void deleteDocObjects(Long userId, String projectId, KbDoc doc, String deleteReason) {
        String objectKey = doc.getObjectKey();
        if (objectKey == null || objectKey.isBlank()) {
            return;
        }
        Long size = doc.getSize();
        if (size == null || size <= 0) {
            throw new BizException("KB-400", "size invalid");
        }
        // TODO: Legacy object-backed docs created before kbdoc_size tracking may have no positive usage snapshot yet.
        // Deleting them currently tries to apply a negative delta first and can be rejected with "used cannot be negative".
        kbDocStorageUsageAppService.recordDocDeleted(userId, projectId, doc.getDocId(), objectKey, size, deleteReason);
        storageClient.deletePrefix(support.buildObjectPrefix(objectKey));
    }

    private void requireOwnerRole(String projectId, Long userId) {
        ProjectRole role = support.requireRole(projectId, userId);
        if (role != ProjectRole.OWNER) {
            throw new BizException("KB-403", "permission denied");
        }
    }
}

