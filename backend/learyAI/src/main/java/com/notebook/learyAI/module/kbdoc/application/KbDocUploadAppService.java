// Responsibility: Handle knowledge base document upload use cases.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.infrastructure.cache.PreviewStsCache;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.storage.StsCredentials;
import com.notebook.learyAI.shared.storage.TemporaryUrlPurpose;
import com.notebook.learyAI.shared.storage.TemporaryUrl;
import com.notebook.learyAI.shared.storage.UploadPolicy;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.usage.domain.model.UsageAction;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;
import com.notebook.learyAI.module.usage.interfaces.facade.UsageGuard;
import com.notebook.learyAI.shared.exception.BizException;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UrlImportResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

@Service
public class KbDocUploadAppService {
    private static final Logger log = LoggerFactory.getLogger(KbDocUploadAppService.class);
    private static final String TASK_TYPE_DOCUMENT_PIPELINE = TaskTypes.DOCUMENT_PIPELINE;
    private static final String DOC_SOURCE_TYPE_OBJECT_KEY = "objectKey";
    private static final String DOC_SOURCE_TYPE_URL = "url";
    private static final String DOC_SOURCE_TYPE_TEXT = "text";
    private static final String DOC_FILE_TYPE_URL = "url";
    private static final String DOC_FILE_TYPE_TEXT = "txt";

    private final KbDocRepository docRepository;
    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    private final KbDocStorageUsageAppService kbDocStorageUsageAppService;
    private final UsageGuard usageGuard;
    private final StorageClient storageClient;
    private final PreviewStsCache previewStsCache;
    private final KbDocQueryCache kbDocQueryCache;
    private final KbDocAppSupport support;
    private final long stsExpireSeconds;
    private final String storageProvider;

    public KbDocUploadAppService(KbDocRepository docRepository,
                                 TaskAppService taskAppService,
                                 TaskStatusService taskStatusService,
                                 TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                 KbDocStorageUsageAppService kbDocStorageUsageAppService,
                                 UsageGuard usageGuard,
                                 StorageClient storageClient,
                                 PreviewStsCache previewStsCache,
                                 KbDocQueryCache kbDocQueryCache,
                                 KbDocAppSupport support,
                                 @Value("${kb.storage.sts-expire-seconds:7200}") long stsExpireSeconds,
                                 @Value("${kb.storage.provider:minio-stub}") String storageProvider) {
        this.docRepository = docRepository;
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.taskWorkflowOrchestrator = taskWorkflowOrchestrator;
        this.kbDocStorageUsageAppService = kbDocStorageUsageAppService;
        this.usageGuard = usageGuard;
        this.storageClient = storageClient;
        this.previewStsCache = previewStsCache;
        this.kbDocQueryCache = kbDocQueryCache;
        this.support = support;
        this.stsExpireSeconds = stsExpireSeconds;
        this.storageProvider = storageProvider;
    }

    @Transactional
    public UploadPrepareResult prepareUpload(String projectId, String kbId, String docId, String fileType, Long size,
                                             String hash, String purpose) {
        try {
            Long userId = support.requireUserId();
            String normalizedProjectId = support.requireProjectId(projectId);
            ProjectRole role = support.requireRole(normalizedProjectId, userId);
            String normalizedFileType = support.normalizeRequired(fileType, "fileType");
            String uploadContentType = resolveContentType(normalizedFileType);
            TemporaryUrlPurpose resolvedPurpose = support.resolvePurpose(
                    purpose,
                    EnumSet.of(TemporaryUrlPurpose.UPLOAD, TemporaryUrlPurpose.PREVIEW)
            );
            if (resolvedPurpose != TemporaryUrlPurpose.PREVIEW) {
                requireAdminOrOwner(role);
            }
            if (resolvedPurpose == TemporaryUrlPurpose.PREVIEW) {
                String normalizedDocId = support.normalizeRequired(docId, "docId");
                ExistingObject existing = findExistingObject(normalizedProjectId, normalizedDocId);
                TemporaryUrl temporaryUrl = storageClient.createTemporaryUrl(existing.objectKey, resolvedPurpose);
                return new UploadPrepareResult(normalizedDocId, existing.taskId, existing.objectKey,
                        null, temporaryUrl);
            }
            String normalizedDocId = support.normalizeOptional(docId);
            if (normalizedDocId == null) {
                normalizedDocId = generateDocId(normalizedProjectId);
            }
            if (size == null || size <= 0) {
                throw new BizException("KB-400", "size invalid");
            }
            requireStorageQuota(userId, normalizedProjectId, size);
            if (docRepository.existsByDocId(normalizedDocId, normalizedProjectId)) {
                throw new BizException("KB-409", "docId exists");
            }
            String normalizedKbId = support.normalizeRequired(kbId, "kbId");
            support.requireKbInternalId(normalizedProjectId, normalizedKbId, userId, false);
            String objectKey = support.buildObjectKey(userId, normalizedDocId, normalizedFileType);
            Map<String, Object> pipelineContext = new HashMap<>();
            pipelineContext.put("docId", normalizedDocId);
            pipelineContext.put("sourceType", DOC_SOURCE_TYPE_OBJECT_KEY);
            pipelineContext.put("source", objectKey);
            pipelineContext.put("objectKey", objectKey);
            pipelineContext.put("fileType", normalizedFileType);
            pipelineContext.put("size", size);
            if (hash != null && !hash.isBlank()) {
                pipelineContext.put("hash", hash.trim());
            }
            Instant now = Instant.now();
            Task saved = taskAppService.createVisibleTask(normalizedProjectId, normalizedKbId, userId, TASK_TYPE_DOCUMENT_PIPELINE,
                    normalizedDocId, TaskStatus.UPLOADING, support.writeMetadata(pipelineContext), now);
            UploadPolicy policy = storageClient.createUploadPolicy(objectKey, size, uploadContentType);
            TemporaryUrl temporaryUrl = storageClient.createTemporaryUrl(objectKey, resolvedPurpose);
            return new UploadPrepareResult(normalizedDocId, saved.getPublicTaskId(), objectKey, policy, temporaryUrl);
        } catch (BizException ex) {
            log.warn("kb doc prepare upload failed: projectId={}, kbId={}, docId={}, fileType={}, size={}, purpose={}, code={}, message={}",
                    projectId, kbId, docId, fileType, size, purpose, ex.getCode(), ex.getMessage());
            throw ex;
        } catch (RuntimeException ex) {
            log.error("kb doc prepare upload crashed: projectId={}, kbId={}, docId={}, fileType={}, size={}, purpose={}",
                    projectId, kbId, docId, fileType, size, purpose, ex);
            throw ex;
        }
    }

    @Transactional
    public UploadConfirmResult confirmUpload(String projectId, String docId, String objectKey, String etag, Long size,
                                             String name, String kbId) {
        try {
            Long userId = support.requireUserId();
            String normalizedProjectId = support.requireProjectId(projectId);
            ProjectRole role = support.requireRole(normalizedProjectId, userId);
            requireAdminOrOwner(role);
            String normalizedDocId = support.normalizeRequired(docId, "docId");
            String normalizedObjectKey = support.normalizeRequired(objectKey, "objectKey");
            String normalizedKbId = support.normalizeRequired(kbId, "kbId");
            Long kbInternalId = support.requireKbInternalId(normalizedProjectId, normalizedKbId, userId, false);
            Task task = taskAppService.findLatestDocumentPipelineByDocId(normalizedProjectId, normalizedDocId)
                    .orElseThrow(() -> new BizException("KB-404", "task not found"));
            if (task.getKbId() == null || !normalizedKbId.equals(task.getKbId().trim())) {
                throw new BizException("KB-404", "task not found");
            }
            storageClient.verifyObject(normalizedObjectKey, size, etag);

            Map<String, Object> pipelineContext = support.readMetadata(task.getPipelineContext());
            pipelineContext.put("docId", normalizedDocId);
            pipelineContext.put("sourceType", DOC_SOURCE_TYPE_OBJECT_KEY);
            pipelineContext.put("source", normalizedObjectKey);
            pipelineContext.put("objectKey", normalizedObjectKey);
            if (size != null) {
                pipelineContext.put("size", size);
            }
            if (etag != null && !etag.isBlank()) {
                pipelineContext.put("etag", etag.trim());
            }
            String normalizedName = support.normalizeOptional(name);
            if (normalizedName != null) {
                pipelineContext.put("name", normalizedName);
            }
            String updatedPipelineContext = support.writeMetadata(pipelineContext);
            long uploadedSize = resolveUploadedSize(size, pipelineContext);
            requireStorageQuota(userId, normalizedProjectId, uploadedSize);
            taskStatusService.updateStatus(task.getTaskRecordId(), normalizedProjectId, TaskStatus.UPLOADED, updatedPipelineContext,
                    "status_change");
            taskStatusService.updateStatus(task.getTaskRecordId(), normalizedProjectId, TaskStatus.PROCESSING, updatedPipelineContext,
                    "status_change");
            kbDocStorageUsageAppService.recordUploadConfirmed(
                    userId,
                    normalizedProjectId,
                    normalizedDocId,
                    normalizedObjectKey,
                    uploadedSize,
                    task.getTaskRecordId()
            );
            support.addDoc(normalizedProjectId, normalizedDocId, pipelineContext, TaskStatus.PROCESSING, Instant.now());
            KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                    .orElseThrow(() -> new BizException("KB-404", "doc not found"));
            support.bindDocInternal(normalizedProjectId, doc.getId(), kbInternalId, userId);
            taskWorkflowOrchestrator.startPipeline(task, pipelineContext, userId);
            kbDocQueryCache.evictDoc(normalizedProjectId, doc.getId(), doc.getDocId());

            return new UploadConfirmResult(requirePublicTaskId(task), TaskStatus.PROCESSING.name());
        } catch (BizException ex) {
            log.warn("kb doc confirm upload failed: projectId={}, kbId={}, docId={}, objectKey={}, size={}, etagPresent={}, code={}, message={}",
                    projectId, kbId, docId, objectKey, size, etag != null && !etag.isBlank(), ex.getCode(), ex.getMessage());
            throw ex;
        } catch (RuntimeException ex) {
            log.error("kb doc confirm upload crashed: projectId={}, kbId={}, docId={}, objectKey={}, size={}, etagPresent={}",
                    projectId, kbId, docId, objectKey, size, etag != null && !etag.isBlank(), ex);
            throw ex;
        }
    }

    @Transactional
    public UrlImportResponse importUrl(String projectId, String kbId, String url, String name) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        ProjectRole role = support.requireRole(normalizedProjectId, userId);
        requireAdminOrOwner(role);
        String normalizedKbId = support.normalizeRequired(kbId, "kbId");
        String normalizedUrl = support.requireSupportedMediaUrl(url);
        Long kbInternalId = support.requireKbInternalId(normalizedProjectId, normalizedKbId, userId, false);
        String normalizedDocId = generateDocId(normalizedProjectId);
        String normalizedName = support.normalizeOptional(name);
        String resolvedDocName = support.buildSupportedMediaDocName(normalizedUrl, normalizedName);
        Map<String, Object> pipelineContext = new HashMap<>();
        pipelineContext.put("docId", normalizedDocId);
        pipelineContext.put("sourceType", DOC_SOURCE_TYPE_URL);
        pipelineContext.put("source", normalizedUrl);
        pipelineContext.put("fileType", DOC_FILE_TYPE_URL);
        pipelineContext.put("size", 0L);
        pipelineContext.put("name", resolvedDocName);
        Instant now = Instant.now();
        Task saved = taskAppService.createVisibleTask(normalizedProjectId, normalizedKbId, userId,
                TASK_TYPE_DOCUMENT_PIPELINE, normalizedDocId, TaskStatus.PROCESSING, support.writeMetadata(pipelineContext), now);
        support.addDoc(normalizedProjectId, normalizedDocId, pipelineContext, TaskStatus.PROCESSING, now);
        KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        support.bindDocInternal(normalizedProjectId, doc.getId(), kbInternalId, userId);
        taskWorkflowOrchestrator.startPipeline(saved, pipelineContext, userId);
        taskStatusService.publishSnapshot(saved, "create");
        kbDocQueryCache.evictDoc(normalizedProjectId, doc.getId(), doc.getDocId());
        return new UrlImportResponse(normalizedDocId, saved.getPublicTaskId(), TaskStatus.PROCESSING.name());
    }

    @Transactional
    public UrlImportResponse importText(String projectId, String kbId, String text, String name) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        ProjectRole role = support.requireRole(normalizedProjectId, userId);
        requireAdminOrOwner(role);
        String normalizedKbId = support.normalizeRequired(kbId, "kbId");
        String normalizedText = support.normalizeRequired(text, "text");
        Long kbInternalId = support.requireKbInternalId(normalizedProjectId, normalizedKbId, userId, false);
        String normalizedDocId = generateDocId(normalizedProjectId);
        String resolvedDocName = resolveTextDocName(normalizedText, name);
        long textSize = normalizedText.getBytes(StandardCharsets.UTF_8).length;
        Map<String, Object> pipelineContext = new HashMap<>();
        pipelineContext.put("docId", normalizedDocId);
        pipelineContext.put("sourceType", DOC_SOURCE_TYPE_TEXT);
        pipelineContext.put("source", normalizedText);
        pipelineContext.put("fileType", DOC_FILE_TYPE_TEXT);
        pipelineContext.put("size", textSize);
        pipelineContext.put("name", resolvedDocName);
        Instant now = Instant.now();
        Task saved = taskAppService.createVisibleTask(normalizedProjectId, normalizedKbId, userId,
                TASK_TYPE_DOCUMENT_PIPELINE, normalizedDocId, TaskStatus.PROCESSING, support.writeMetadata(pipelineContext), now);
        support.addDoc(normalizedProjectId, normalizedDocId, pipelineContext, TaskStatus.PROCESSING, now);
        KbDoc doc = docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        support.bindDocInternal(normalizedProjectId, doc.getId(), kbInternalId, userId);
        taskWorkflowOrchestrator.startPipeline(saved, pipelineContext, userId);
        taskStatusService.publishSnapshot(saved, "create");
        kbDocQueryCache.evictDoc(normalizedProjectId, doc.getId(), doc.getDocId());
        return new UrlImportResponse(normalizedDocId, saved.getPublicTaskId(), TaskStatus.PROCESSING.name());
    }

    public StsCredentials issuePreviewCredentials(String projectId, String docId) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        support.requireMember(normalizedProjectId, userId);
        String normalizedDocId = support.normalizeRequired(docId, "docId");
        docRepository.findByDocId(normalizedDocId, normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "doc not found"));
        String normalizedProvider = resolveStorageProvider();
        Optional<StsCredentials> cached = previewStsCache.get(normalizedProvider, userId);
        if (cached.isPresent() && !isExpired(cached.get())) {
            return cached.get();
        }
        String prefix = support.buildUserPrefix(userId);
        long safeDurationSeconds = stsExpireSeconds <= 0 ? 7200 : stsExpireSeconds;
        StsCredentials issued = storageClient.issueStsCredentials(prefix, safeDurationSeconds);
        previewStsCache.put(normalizedProvider, userId, issued, Duration.ofMinutes(50));
        return issued;
    }

    private ExistingObject findExistingObject(String projectId, String docId) {
        Optional<Task> latestTask = taskAppService.findLatestDocumentPipelineByDocId(projectId, docId);
        if (latestTask.isPresent()) {
            Task task = latestTask.get();
            Map<String, Object> pipelineContext = support.readMetadata(task.getPipelineContext());
            String objectKey = support.asString(pipelineContext.get("objectKey"));
            if (objectKey != null && !objectKey.isBlank()) {
                return new ExistingObject(task.getPublicTaskId(), objectKey);
            }
        }
        Optional<KbDoc> doc = docRepository.findByDocId(docId, projectId);
        if (doc.isPresent()) {
            String objectKey = doc.get().getObjectKey();
            if (objectKey != null && !objectKey.isBlank()) {
                return new ExistingObject(null, objectKey);
            }
        }
        throw new BizException("KB-404", "object not found");
    }

    private String generateDocId(String projectId) {
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = UUID.randomUUID().toString().replace("-", "");
            if (!docRepository.existsByDocId(candidate, projectId)) {
                return candidate;
            }
        }
        throw new BizException("KB-500", "docId generate failed");
    }

    private String resolveTextDocName(String text, String explicitName) {
        String normalizedExplicitName = support.normalizeOptional(explicitName);
        if (normalizedExplicitName != null) {
            return normalizedExplicitName;
        }
        String compact = text.trim().replaceAll("\\s+", " ");
        String prefix = compact.length() <= 5 ? compact : compact.substring(0, 5);
        return prefix + "...";
    }

    private String resolveContentType(String fileType) {
        if (fileType == null || fileType.isBlank()) {
            return "application/octet-stream";
        }
        String lower = fileType.trim().toLowerCase();
        if ("pdf".equals(lower)) {
            return "application/pdf";
        }
        if ("docx".equals(lower)) {
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        }
        if ("pptx".equals(lower)) {
            return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
        }
        if ("md".equals(lower) || "markdown".equals(lower)) {
            return "text/markdown";
        }
        if ("txt".equals(lower)) {
            return "text/plain";
        }
        if ("jpg".equals(lower) || "jpeg".equals(lower)) {
            return "image/jpeg";
        }
        if ("png".equals(lower)) {
            return "image/png";
        }
        if ("gif".equals(lower)) {
            return "image/gif";
        }
        return "application/octet-stream";
    }

    private void requireAdminOrOwner(ProjectRole role) {
        if (role != ProjectRole.OWNER && role != ProjectRole.ADMIN) {
            throw new BizException("KB-403", "permission denied");
        }
    }

    private String resolveStorageProvider() {
        if (storageProvider == null || storageProvider.isBlank()) {
            return "minio-stub";
        }
        return storageProvider.trim();
    }

    private boolean isExpired(StsCredentials credentials) {
        Instant expiresAt = credentials.getExpiresAt();
        return expiresAt == null || !expiresAt.isAfter(Instant.now());
    }

    private void requireStorageQuota(Long userId, String projectId, long size) {
        UsageDecision decision = usageGuard.check(userId, projectId, UsageAction.KBDOC_SIZE, size);
        if (!decision.allowed()) {
            throw new BizException(decision.denyCode(), decision.denyMessage());
        }
    }

    private long resolveUploadedSize(Long requestedSize, Map<String, Object> metadata) {
        Long metadataSize = support.asLong(metadata.get("size"));
        long resolvedSize = requestedSize != null && requestedSize > 0 ? requestedSize : (metadataSize == null ? -1L : metadataSize);
        if (resolvedSize <= 0) {
            throw new BizException("KB-400", "size invalid");
        }
        return resolvedSize;
    }

    private static class ExistingObject {
        private final String taskId;
        private final String objectKey;

        private ExistingObject(String taskId, String objectKey) {
            this.taskId = taskId;
            this.objectKey = objectKey;
        }
    }

    private String requirePublicTaskId(Task task) {
        if (task == null || task.getPublicTaskId() == null || task.getPublicTaskId().isBlank()) {
            throw new BizException("KB-500", "publicTaskId required");
        }
        return task.getPublicTaskId().trim();
    }
}
