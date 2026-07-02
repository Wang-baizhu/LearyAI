// Responsibility: Handle phase2 template plugin manifest parsing, persistence and artifact uploads.
// TODO: 该应用服务已同时承担 manifest 解析、发布状态机、artifact 校验、预览代理等职责，后续应按发布编排/校验/预览进一步拆分。
package com.notebook.learyAI.module.template.application;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.storage.UploadPolicy;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.template.domain.repository.TemplatePluginManifestRepository;
import com.notebook.learyAI.module.template.domain.service.TemplateDomainService;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import com.notebook.learyAI.shared.storage.TemporaryUrlPurpose;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

@Service
public class TemplatePluginManagementAppService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() { };
    private static final String DEV_REFERENCE_WARNING_MESSAGE =
            "开发态引用的全量校验当前仅记为 WARN，后续将收口到 frontend/docs/exec-plans/undo/2026-05-24-template-plugin-workbench-plan.md 对 playground/workbench 补齐。";
    private static final Pattern HTML_REFERENCE_PATTERN = Pattern.compile(
            "(?:src|href)\\s*=\\s*[\"']([^\"']+)[\"']|url\\(([^)]+)\\)",
            Pattern.CASE_INSENSITIVE
    );

    private final TemplatePluginManifestRepository manifestRepository;
    private final TemplateDomainService templateDomainService;
    private final AuthzSdk authzSdk;
    private static final String GLOBAL_TASK_PROJECT_ID = "00000000-0000-0000-0000-000000000000";
    private static final String TEMPLATE_PLUGIN_PUBLISH_KB_ID = "template-plugin-publish";

    private final StorageClient storageClient;
    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    private final ObjectMapper objectMapper;
    private final String templatePreviewBaseUrl;

    public TemplatePluginManagementAppService(TemplatePluginManifestRepository manifestRepository,
                                              TemplateDomainService templateDomainService,
                                              AuthzSdk authzSdk,
                                              StorageClient storageClient,
                                              TaskAppService taskAppService,
                                              TaskStatusService taskStatusService,
                                              TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                              ObjectMapper objectMapper) {
        this(
                manifestRepository,
                templateDomainService,
                authzSdk,
                storageClient,
                taskAppService,
                taskStatusService,
                taskWorkflowOrchestrator,
                objectMapper,
                "http://localhost:7999"
        );
    }

    @Autowired
    public TemplatePluginManagementAppService(TemplatePluginManifestRepository manifestRepository,
                                              TemplateDomainService templateDomainService,
                                              AuthzSdk authzSdk,
                                              StorageClient storageClient,
                                              TaskAppService taskAppService,
                                              TaskStatusService taskStatusService,
                                              TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                              ObjectMapper objectMapper,
                                              @Value("${LEARY_TEMPLATE_PREVIEW_BASE_URL:http://localhost:7999}") String templatePreviewBaseUrl) {
        this.manifestRepository = manifestRepository;
        this.templateDomainService = templateDomainService;
        this.authzSdk = authzSdk;
        this.storageClient = storageClient;
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.taskWorkflowOrchestrator = taskWorkflowOrchestrator;
        this.objectMapper = objectMapper;
        this.templatePreviewBaseUrl = normalizeBaseUrl(templatePreviewBaseUrl);
    }

    public ParseManifestResult parseManifest(MultipartFile file) {
        Map<String, Object> manifest = parseLooseManifest(file);
        Map<String, Object> promptSchema = readMap(manifest.get("prompt_json_schema"));
        Map<String, Object> normalizedFormValue = new LinkedHashMap<>();
        Map<String, Object> normalizedPrompt = new LinkedHashMap<>();
        normalizedPrompt.put("toolPrompt", readString(promptSchema.get("toolPrompt")));
        normalizedPrompt.put("flow_custom_prompt", readNullableString(promptSchema.get("flow_custom_prompt")));
        normalizedFormValue.put("displayName", manifest.get("displayName"));
        normalizedFormValue.put("sdkVersion", manifest.get("sdkVersion"));
        normalizedFormValue.put("promptJsonSchema", normalizedPrompt);
        normalizedFormValue.put("dataBindingsJson", readMap(manifest.get("dataBindings")));
        normalizedFormValue.put("capabilityJson", normalizeCapabilities(manifest));
        return new ParseManifestResult(manifest, normalizedFormValue, List.of());
    }

    @Transactional
    public TemplatePluginManifest create(CreateCommand command) {
        Long currentUserId = requireUserId();
        String normalizedPluginId = templateDomainService.normalizeOptionalPluginId(command.pluginId());
        String normalizedProjectId = normalizeOptionalProjectId(command.projectId());
        String normalizedName = templateDomainService.normalizeName(command.name());
        String scope = normalizeScope(command.scope(), normalizedProjectId);
        String uploadState = "empty";
        String visibility = normalizeVisibility(command.visibility());
        String status = "inactive";
        String displayName = requireNonBlank(command.displayName(), "displayName required");
        String sdkVersion = requireNonBlank(command.sdkVersion(), "sdkVersion required");
        Map<String, Object> promptSchema = normalizePromptSchema(command.promptJsonSchema());
        Map<String, Object> dataBindings = copyMap(command.dataBindingsJson());
        Map<String, Object> capabilityJson = copyMap(command.capabilityJson());
        Map<String, Object> importedManifest = copyMap(command.importedManifest());
        ensureCreatePermission(normalizedProjectId);
        Instant now = Instant.now();
        return manifestRepository.save(new TemplatePluginManifest(
                normalizedPluginId == null ? UUID.randomUUID().toString() : normalizedPluginId,
                normalizedName,
                normalizedProjectId,
                currentUserId,
                displayName,
                null,
                null,
                sdkVersion,
                capabilityJson,
                promptSchema,
                dataBindings,
                status,
                scope,
                visibility,
                uploadState,
                importedManifest,
                createValidationResult(null, List.of(), List.of()),
                now,
                now
        ));
    }

    public List<TemplatePluginManifest> listOwnedManifests() {
        return manifestRepository.findByOwnerId(requireUserId());
    }

    @Transactional
    public TemplatePluginManifest update(String pluginId, UpdateCommand command) {
        TemplatePluginManifest existing = requireManifest(pluginId);
        ensureManagePermission(existing);
        String existingProjectId = existing.getProjectId();
        String nextScope = normalizeScope(command.scope(), existingProjectId);
        String targetProjectId = "global".equals(nextScope) ? null : existingProjectId;
        String normalizedName = templateDomainService.normalizeName(command.name());
        TemplatePluginManifest saved = manifestRepository.save(new TemplatePluginManifest(
                existing.getPluginId(),
                normalizedName,
                targetProjectId,
                existing.getOwnerId(),
                requireNonBlank(command.displayName(), "displayName required"),
                existing.getEntryUri(),
                existing.getAssetBaseUri(),
                requireNonBlank(command.sdkVersion(), "sdkVersion required"),
                copyMap(command.capabilityJson()),
                normalizePromptSchema(command.promptJsonSchema()),
                copyMap(command.dataBindingsJson()),
                existing.getStatus(),
                nextScope,
                normalizeVisibility(command.visibility()),
                existing.getUploadState(),
                existing.getSourceManifest(),
                existing.getValidationResult(),
                existing.getCreatedAt(),
                Instant.now()
        ));
        return saved;
    }

    public TemplatePluginManifest detail(String pluginId) {
        TemplatePluginManifest manifest = requireManifest(pluginId);
        ensureManagePermission(manifest);
        return manifest;
    }

    @Transactional
    public void delete(String pluginId) {
        TemplatePluginManifest manifest = requireManifest(pluginId);
        ensureManagePermission(manifest);
        ensureDeleteAllowed(manifest);
        manifestRepository.deleteByPluginId(manifest.getPluginId());
        storageClient.deletePrefix(buildObjectPrefix(manifest.getPluginId()));
        storageClient.deletePrefix(buildStagingObjectPrefix(manifest.getPluginId()));
    }

    @Transactional
    public PrepareArtifactUploadResult prepareArtifactUpload(String pluginId,
                                                             PrepareArtifactUploadCommand command) {
        TemplatePluginManifest manifest = requireManifest(pluginId);
        ensureManagePermission(manifest);
        ensureArtifactUploadAllowed(manifest, command.replaceCurrentVersion());
        long size = requirePositiveSize(command.size());
        String contentType = requireNonBlank(command.contentType(), "contentType required");
        String objectKey = buildStagingObjectKey(manifest.getPluginId());
        UploadPolicy uploadPolicy = storageClient.createUploadPolicy(objectKey, size, contentType);
        TemplatePluginManifest saved = manifestRepository.save(copyManifest(
                manifest,
                manifest.getEntryUri(),
                manifest.getAssetBaseUri(),
                manifest.getStatus(),
                manifest.getUploadState(),
                manifest.getSourceManifest(),
                manifest.getValidationResult()
        ));
        return new PrepareArtifactUploadResult(saved, objectKey, uploadPolicy);
    }

    @Transactional
    public ConfirmArtifactUploadResult confirmArtifactUpload(String pluginId,
                                                             ConfirmArtifactUploadCommand command) {
        TemplatePluginManifest manifest = requireManifest(pluginId);
        ensureManagePermission(manifest);
        ensureArtifactUploadAllowed(manifest, command.replaceCurrentVersion());
        String expectedObjectKey = buildStagingObjectKey(manifest.getPluginId());
        String objectKey = requireNonBlank(command.objectKey(), "objectKey required");
        if (!expectedObjectKey.equals(objectKey)) {
            throw new BizException("TEMPLATE-400", "objectKey invalid");
        }
        long size = requirePositiveSize(command.size());
        storageClient.verifyObject(objectKey, size, normalizeOptionalText(command.etag()));
        TemplatePluginManifest saved = manifestRepository.save(copyManifest(
                manifest,
                null,
                null,
                "inactive",
                "uploaded_pending_validation",
                manifest.getSourceManifest(),
                createValidationResult(null, List.of(), List.of())
        ));
        Task publishTask = createPublishTask(saved, objectKey);
        return new ConfirmArtifactUploadResult(saved, publishTask.getPublicTaskId(), publishTask.getStatus().name());
    }

    @Transactional
    public PublishValidationExecutionResult executePublishValidation(PublishValidationExecutionCommand command) {
        TemplatePluginManifest manifest = requireManifest(command.pluginId());
        if ("validated".equalsIgnoreCase(manifest.getUploadState())) {
            return PublishValidationExecutionResult.success(Map.of(
                    "pluginId", manifest.getPluginId(),
                    "status", manifest.getStatus(),
                    "uploadState", manifest.getUploadState(),
                    "validation", manifest.getValidationResult(),
                    "outputText", "模板插件发布完成"
            ));
        }
        TemplatePluginManifest validatingManifest = manifestRepository.save(copyManifest(
                manifest,
                manifest.getEntryUri(),
                manifest.getAssetBaseUri(),
                manifest.getStatus(),
                "validating",
                manifest.getSourceManifest(),
                manifest.getValidationResult()
        ));
        try {
            byte[] archiveBytes = storageClient.readObject(command.objectKey());
            ArtifactBundleValidationResult validation = validateArtifactArchive(archiveBytes, validatingManifest);
            TemplatePluginManifest activated = activateValidatedArtifact(validatingManifest, validation);
            return PublishValidationExecutionResult.success(buildValidationTaskResult(activated));
        } catch (ArtifactValidationException ex) {
            TemplatePluginManifest failed = markValidationFailed(
                    validatingManifest,
                    ex.sourceManifest(),
                    ex.warnings(),
                    ex.checks(),
                    ex.getMessage()
            );
            return PublishValidationExecutionResult.failed(buildValidationTaskResult(failed), ex.getMessage());
        } catch (BizException ex) {
            if (isNonRetryableValidationException(ex)) {
                TemplatePluginManifest failed = markValidationFailed(
                        validatingManifest,
                        validatingManifest.getSourceManifest(),
                        List.of(),
                        List.of(),
                        ex.getMessage()
                );
                return PublishValidationExecutionResult.failed(buildValidationTaskResult(failed), ex.getMessage());
            }
            throw ex;
        } catch (RuntimeException ex) {
            throw new RetryablePublishValidationException("template plugin publish validation retry required", ex);
        }
    }

    @Transactional
    public PublishValidationExecutionResult markPublishValidationRetryExhausted(PublishValidationExecutionCommand command,
                                                                                String message) {
        TemplatePluginManifest manifest = requireManifest(command.pluginId());
        TemplatePluginManifest failed = markValidationFailed(
                manifest,
                manifest.getSourceManifest(),
                List.of(),
                List.of(),
                message == null || message.isBlank() ? "template plugin publish validation retry exhausted" : message.trim()
        );
        return PublishValidationExecutionResult.failed(buildValidationTaskResult(failed), message);
    }

    public PreviewEntryResult previewEntry(String pluginId) {
        TemplatePluginManifest manifest = requireManifest(pluginId);
        ensurePreviewPermission(manifest);
        if (!hasPreviewContent(manifest)) {
            throw new BizException("TEMPLATE-404", "preview entry not found");
        }
        return new PreviewEntryResult(
                manifest.getPluginId(),
                buildPreviewEntryUri(manifest),
                manifest.getSdkVersion(),
                manifest.getCapabilities()
        );
    }

    public PreviewAuthorizeResult authorizePreview(String pluginId, String requestedPath) {
        TemplatePluginManifest manifest = requireManifest(pluginId);
        ensurePreviewPermission(manifest);
        if (!hasPreviewContent(manifest)) {
            throw new BizException("TEMPLATE-404", "preview entry not found");
        }
        String resolvedPath = resolvePreviewRequestPath(manifest, requestedPath);
        String objectKey = buildObjectPrefix(manifest.getPluginId()) + resolvedPath;
        String originUrl = storageClient.createTemporaryUrl(objectKey, TemporaryUrlPurpose.PREVIEW).getUrl();
        return new PreviewAuthorizeResult(
                manifest.getPluginId(),
                originUrl,
                isHtmlPath(resolvedPath) ? "entry" : "asset"
        );
    }

    public PreviewAssetResult previewAsset(String pluginId, String requestedPath) {
        TemplatePluginManifest manifest = requireManifest(pluginId);
        ensurePreviewPermission(manifest);
        if (!hasPreviewContent(manifest)) {
            throw new BizException("TEMPLATE-404", "preview entry not found");
        }
        // TODO: 高并发预览场景下将静态资源分发下沉到对象存储/CDN，后端仅保留鉴权与入口解析。
        String resolvedPath = resolvePreviewRequestPath(manifest, requestedPath);
        byte[] content = storageClient.readObject(buildObjectPrefix(pluginId) + resolvedPath);
        return PreviewAssetResult.content(content, guessContentType(resolvedPath), isHtmlPath(resolvedPath));
    }

    private TemplatePluginManifest markValidationFailed(TemplatePluginManifest manifest,
                                                        Map<String, Object> sourceManifest,
                                                        List<String> warnings,
                                                        List<ValidationCheck> checks,
                                                        String message) {
        return manifestRepository.save(copyManifest(
                manifest,
                null,
                null,
                manifest.getStatus(),
                "validation_failed",
                sourceManifest == null ? manifest.getSourceManifest() : sourceManifest,
                createValidationResult(Boolean.FALSE, warnings, appendFailureSummary(checks, message))
        ));
    }

    private void validateNoPluginId(Map<String, Object> manifest) {
        if (manifest.containsKey("pluginId")) {
            throw new BizException("TEMPLATE-400", "manifest pluginId forbidden");
        }
    }

    private ArtifactBundleValidationResult validateArtifactArchive(byte[] archiveBytes, TemplatePluginManifest manifest) {
        try {
            ZipBundle bundle = readZipBundle(new ByteArrayInputStream(archiveBytes));
            Map<String, Object> uploadedManifest = parseManifestJson(bundle.entries().get("manifest.json"));
            validateNoPluginId(uploadedManifest);
            String entryHtml = normalizeRelativePath(readString(uploadedManifest.get("entryHtml")), "entryHtml required");
            String assetBaseDir = normalizeRelativePath(readNullableString(uploadedManifest.get("assetBaseDir")), null);
            List<ValidationCheck> checks = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            checks.add(check("MANIFEST_EXISTS", true, "manifest.json 已找到"));
            checks.add(check("ENTRY_PATH_SAFE", true, "entryHtml 路径合法"));
            checks.add(check("ASSET_BASE_DIR_SAFE", assetBaseDir == null || !assetBaseDir.isBlank(), "assetBaseDir 路径合法"));
            if (!bundle.entries().containsKey(entryHtml)) {
                checks.add(check("ENTRY_HTML_EXISTS", false, "entryHtml 指向的文件不存在"));
                throw validationFailure(uploadedManifest, warnings, checks, "artifact entry not found");
            }
            checks.add(check("ENTRY_HTML_EXISTS", true, "entryHtml 指向的文件存在"));
            validateAssetBaseDir(bundle.entries(), assetBaseDir, checks);
            validateFileContentReferences(bundle.entries(), entryHtml, checks, warnings);
            return new ArtifactBundleValidationResult(uploadedManifest, bundle.entries(), entryHtml, assetBaseDir, warnings, checks);
        } catch (IOException ex) {
            throw new BizException("TEMPLATE-400", "artifact zip invalid");
        }
    }

    private TemplatePluginManifest activateValidatedArtifact(TemplatePluginManifest manifest,
                                                             ArtifactBundleValidationResult validation) {
        String prefix = buildObjectPrefix(manifest.getPluginId());
        for (Map.Entry<String, byte[]> entry : orderBundleEntriesForUpload(validation.entries(), validation.entryHtml())) {
            storageClient.uploadObject(prefix + entry.getKey(),
                    new ByteArrayInputStream(entry.getValue()),
                    entry.getValue().length,
                    guessContentType(entry.getKey()));
        }
        String entryUri = storageClient.buildObjectUrl(prefix + validation.entryHtml());
        String assetBaseUri = validation.assetBaseDir() == null
                ? null
                : storageClient.buildObjectUrl(prefix + validation.assetBaseDir());
        String nextStatus = resolvePostValidationStatus(manifest.getStatus());
        TemplatePluginManifest saved = manifestRepository.save(copyManifest(
                manifest,
                entryUri,
                assetBaseUri,
                nextStatus,
                "validated",
                validation.sourceManifest(),
                createValidationResult(Boolean.TRUE, validation.warnings(), validation.checks())
        ));
        storageClient.deletePrefix(buildStagingObjectPrefix(
                manifest.getPluginId()
        ));
        return saved;
    }

    private boolean isNonRetryableValidationException(BizException ex) {
        String code = ex.getCode();
        return "TEMPLATE-400".equals(code) || "TEMPLATE-404".equals(code);
    }

    private void validateAssetBaseDir(Map<String, byte[]> entries, String assetBaseDir, List<ValidationCheck> checks) {
        if (assetBaseDir == null) {
            checks.add(check("ASSET_BASE_DIR_SAFE", true, "assetBaseDir 可为空"));
            return;
        }
        boolean exists = entries.keySet().stream().anyMatch(path -> path.startsWith(assetBaseDir + "/"));
        checks.add(check("ASSET_BASE_DIR_SAFE", exists, "assetBaseDir 必须存在于上传包中"));
        if (!exists) {
            throw new BizException("TEMPLATE-400", "assetBaseDir invalid");
        }
    }

    private void validateFileContentReferences(Map<String, byte[]> entries,
                                               String entryHtml,
                                               List<ValidationCheck> checks,
                                               List<String> warnings) {
        List<String> devReferenceWarningPaths = new ArrayList<>();
        for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
            String path = entry.getKey();
            String content = new String(entry.getValue(), StandardCharsets.UTF_8);
            if (containsPotentialDevReference(content) && !isReferenceScannable(path)) {
                devReferenceWarningPaths.add(path);
            }
            if (!isReferenceScannable(path)) {
                continue;
            }
            Matcher matcher = HTML_REFERENCE_PATTERN.matcher(content);
            while (matcher.find()) {
                String raw = matcher.group(1) != null ? matcher.group(1) : matcher.group(2);
                String normalizedReference = normalizeReferenceValue(raw, path, checks);
                if (normalizedReference == null) {
                    continue;
                }
                String resolvedPath = resolveRelativeReference(path, normalizedReference);
                if (!entries.containsKey(resolvedPath)) {
                    checks.add(check("RESOURCE_REFERENCES_RESOLVED", false,
                            path + " 引用了不存在的资源 " + normalizedReference));
                    throw new BizException("TEMPLATE-400", "artifact resource not found");
                }
            }
        }
        checks.add(check("RESOURCE_REFERENCES_RESOLVED", true, entryHtml + " 及关联资源可解析"));
        if (devReferenceWarningPaths.isEmpty()) {
            checks.add(check("NO_DEV_REFERENCES", true, "未检测到开发态引用"));
            return;
        }
        warnings.add(DEV_REFERENCE_WARNING_MESSAGE + " 可疑文件: " + String.join(", ", devReferenceWarningPaths));
        checks.add(check(
                "NO_DEV_REFERENCES",
                true,
                "检测到非 HTML/CSS 文件中的潜在开发态引用，当前降级为 WARN；后续由 playground/workbench 补齐校验"
        ));
    }

    private boolean isReferenceScannable(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        return lower.endsWith(".html") || lower.endsWith(".css");
    }

    private String resolveRelativeReference(String currentPath, String reference) {
        String sanitized = reference;
        int queryIndex = sanitized.indexOf('?');
        if (queryIndex >= 0) {
            sanitized = sanitized.substring(0, queryIndex);
        }
        int hashIndex = sanitized.indexOf('#');
        if (hashIndex >= 0) {
            sanitized = sanitized.substring(0, hashIndex);
        }
        if (sanitized.startsWith("/")) {
            throw new BizException("TEMPLATE-400", "artifact contains dev reference");
        }
        String currentDir = "";
        int slashIndex = currentPath.lastIndexOf('/');
        if (slashIndex >= 0) {
            currentDir = currentPath.substring(0, slashIndex + 1);
        }
        return normalizeRelativePath(currentDir + sanitized, "invalid resource path");
    }

    private String normalizeReferenceValue(String raw, String path, List<ValidationCheck> checks) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim().replace("\"", "").replace("'", "");
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (trimmed.isEmpty()
                || trimmed.startsWith("#")
                || trimmed.startsWith("data:")
                || trimmed.startsWith("mailto:")
                || trimmed.startsWith("javascript:")) {
            return null;
        }
        if (lower.startsWith("http://")
                || lower.startsWith("https://")
                || trimmed.startsWith("//")
                || lower.startsWith("file://")
                || lower.startsWith("/src")
                || lower.contains("localhost")) {
            checks.add(check("NO_DEV_REFERENCES", false, path + " 包含开发态引用 " + trimmed));
            throw new BizException("TEMPLATE-400", "artifact contains dev reference");
        }
        return trimmed;
    }

    private boolean containsPotentialDevReference(String content) {
        String lower = content.toLowerCase(Locale.ROOT);
        return lower.contains("localhost")
                || lower.contains("file://")
                || lower.contains("/src/")
                || lower.contains("\"/src")
                || lower.contains("'/src");
    }

    private Map<String, Object> parseLooseManifest(MultipartFile file) {
        try {
            return parseManifestJson(file.getBytes());
        } catch (IOException ex) {
            throw new BizException("TEMPLATE-400", "manifest json invalid");
        }
    }

    private Map<String, Object> parseManifestJson(byte[] bytes) {
        try {
            return objectMapper.readValue(bytes, MAP_TYPE);
        } catch (IOException ex) {
            throw new BizException("TEMPLATE-400", "manifest json invalid");
        }
    }

    private ZipBundle readZipBundle(InputStream inputStream) throws IOException {
        Map<String, byte[]> rawEntries = new LinkedHashMap<>();
        try (ZipInputStream zipInputStream = new ZipInputStream(inputStream)) {
            ZipEntry zipEntry;
            while ((zipEntry = zipInputStream.getNextEntry()) != null) {
                if (zipEntry.isDirectory()) {
                    continue;
                }
                String normalizedName = normalizeZipEntryName(zipEntry.getName());
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                zipInputStream.transferTo(output);
                rawEntries.put(normalizedName, output.toByteArray());
            }
        }
        String manifestPath = locateManifestPath(rawEntries.keySet());
        if (manifestPath == null) {
            throw new BizException("TEMPLATE-400", "artifact manifest missing");
        }
        String rootPrefix = manifestPath.equals("manifest.json")
                ? ""
                : manifestPath.substring(0, manifestPath.length() - "manifest.json".length());
        Map<String, byte[]> normalizedEntries = new LinkedHashMap<>();
        for (Map.Entry<String, byte[]> entry : rawEntries.entrySet()) {
            String normalizedKey = entry.getKey();
            if (!rootPrefix.isEmpty() && normalizedKey.startsWith(rootPrefix)) {
                normalizedKey = normalizedKey.substring(rootPrefix.length());
            }
            normalizedKey = normalizeRelativePath(normalizedKey, "zip entry path invalid");
            normalizedEntries.put(normalizedKey, entry.getValue());
        }
        return new ZipBundle(normalizedEntries);
    }

    private String locateManifestPath(Iterable<String> keys) {
        String manifestPath = null;
        for (String key : keys) {
            if (!key.endsWith("manifest.json")) {
                continue;
            }
            if (manifestPath != null) {
                throw new BizException("TEMPLATE-400", "artifact manifest ambiguous");
            }
            manifestPath = key;
        }
        return manifestPath;
    }

    private String normalizeZipEntryName(String name) {
        String normalized = name.replace('\\', '/');
        while (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }
        if (normalized.startsWith("/") || normalized.contains("../") || normalized.contains("..\\")) {
            throw new BizException("TEMPLATE-400", "zip entry path invalid");
        }
        return normalized;
    }

    private String buildObjectPrefix(String pluginId) {
        return "template-plugins/" + pluginId + "/";
    }

    private String buildStagingObjectPrefix(String pluginId) {
        return "template-plugins-staging/" + pluginId + "/";
    }

    private String buildStagingObjectKey(String pluginId) {
        return buildStagingObjectPrefix(pluginId) + "dist.zip";
    }

    public String buildPreviewEntryUri(TemplatePluginManifest manifest) {
        if (!hasPreviewContent(manifest)) {
            return null;
        }
        String entryPath = resolveEntryPath(manifest);
        if (entryPath == null) {
            return null;
        }
        return joinUrl(templatePreviewBaseUrl, "/preview/" + manifest.getPluginId() + "/" + entryPath);
    }

    public String buildPreviewAssetBaseUri(TemplatePluginManifest manifest) {
        if (!hasPreviewContent(manifest)) {
            return null;
        }
        String assetBaseDir = readAssetBaseDir(manifest);
        if (assetBaseDir == null) {
            return null;
        }
        return joinUrl(templatePreviewBaseUrl, "/preview/" + manifest.getPluginId() + "/" + assetBaseDir);
    }

    private String resolvePreviewRequestPath(TemplatePluginManifest manifest, String requestedPath) {
        String entryPath = resolveEntryPath(manifest);
        if (requestedPath == null || requestedPath.isBlank()) {
            if (entryPath == null) {
                throw new BizException("TEMPLATE-404", "preview entry not found");
            }
            return entryPath;
        }
        return normalizeRelativePath(requestedPath, "preview path invalid");
    }

    private String resolveEntryPath(TemplatePluginManifest manifest) {
        String entryHtml = readEntryHtml(manifest);
        if (entryHtml != null) {
            return entryHtml;
        }
        return null;
    }

    private String readEntryHtml(TemplatePluginManifest manifest) {
        String entryHtml = readString(manifest.getSourceManifest().get("entryHtml"));
        if (entryHtml == null) {
            return null;
        }
        return normalizeRelativePath(entryHtml, "preview entry not found");
    }

    private String readAssetBaseDir(TemplatePluginManifest manifest) {
        String assetBaseDir = readNullableString(manifest.getSourceManifest().get("assetBaseDir"));
        if (assetBaseDir == null) {
            return null;
        }
        return normalizeRelativePath(assetBaseDir, "assetBaseDir invalid");
    }

    private List<Map.Entry<String, byte[]>> orderBundleEntriesForUpload(Map<String, byte[]> entries, String entryHtml) {
        List<Map.Entry<String, byte[]>> orderedEntries = new ArrayList<>();
        Map.Entry<String, byte[]> entryHtmlFile = null;
        for (Map.Entry<String, byte[]> entry : entries.entrySet()) {
            if (entry.getKey().equals(entryHtml)) {
                entryHtmlFile = entry;
                continue;
            }
            orderedEntries.add(entry);
        }
        if (entryHtmlFile != null) {
            orderedEntries.add(entryHtmlFile);
        }
        return orderedEntries;
    }

    private boolean hasPreviewContent(TemplatePluginManifest manifest) {
        return manifest.getEntryUri() != null && !manifest.getEntryUri().isBlank();
    }

    private boolean isHtmlPath(String path) {
        return path != null && path.toLowerCase(Locale.ROOT).endsWith(".html");
    }

    private String guessContentType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) {
            return "text/html";
        }
        if (lower.endsWith(".js")) {
            return "application/javascript";
        }
        if (lower.endsWith(".css")) {
            return "text/css";
        }
        if (lower.endsWith(".json")) {
            return "application/json";
        }
        if (lower.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        return "application/octet-stream";
    }

    private Task createPublishTask(TemplatePluginManifest manifest, String objectKey) {
        Map<String, Object> pipelineContext = new LinkedHashMap<>();
        pipelineContext.put("pluginId", manifest.getPluginId());
        pipelineContext.put("objectKey", objectKey);
        pipelineContext.put("displayName", manifest.getDisplayName());
        String projectId = resolveTaskProjectId(manifest);
        Task task = taskAppService.createVisibleTask(
                projectId,
                TEMPLATE_PLUGIN_PUBLISH_KB_ID,
                requireUserId(),
                TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE,
                manifest.getPluginId(),
                TaskStatus.PROCESSING,
                taskAppService.writeJson(pipelineContext),
                Instant.now()
        );
        taskWorkflowOrchestrator.startPipeline(task, pipelineContext, requireUserId());
        taskStatusService.publishSnapshot(task, "create");
        return task;
    }

    private String resolveTaskProjectId(TemplatePluginManifest manifest) {
        if (manifest.getProjectId() == null || manifest.getProjectId().isBlank()) {
            return GLOBAL_TASK_PROJECT_ID;
        }
        return manifest.getProjectId();
    }

    private Map<String, Object> buildValidationTaskResult(TemplatePluginManifest manifest) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("pluginId", manifest.getPluginId());
        result.put("status", manifest.getStatus());
        result.put("uploadState", manifest.getUploadState());
        result.put("validation", manifest.getValidationResult());
        result.put("outputText", "validated".equalsIgnoreCase(manifest.getUploadState())
                ? "模板插件发布完成"
                : "模板插件发布失败");
        return result;
    }

    private TemplatePluginManifest copyManifest(TemplatePluginManifest manifest,
                                                String entryUri,
                                                String assetBaseUri,
                                                String status,
                                                String uploadState,
                                                Map<String, Object> sourceManifest,
                                                Map<String, Object> validationResult) {
        return new TemplatePluginManifest(
                manifest.getPluginId(),
                manifest.getName(),
                manifest.getProjectId(),
                manifest.getOwnerId(),
                manifest.getDisplayName(),
                entryUri,
                assetBaseUri,
                manifest.getSdkVersion(),
                manifest.getCapabilities(),
                manifest.getPromptSchema(),
                manifest.getDataBindings(),
                status,
                manifest.getScope(),
                manifest.getVisibility(),
                uploadState,
                sourceManifest,
                validationResult,
                manifest.getCreatedAt(),
                Instant.now()
        );
    }

    private String resolvePostValidationStatus(String currentStatus) {
        return "active";
    }

    private void ensureArtifactUploadAllowed(TemplatePluginManifest manifest, boolean replaceCurrentVersion) {
        String uploadState = manifest.getUploadState();
        if (replaceCurrentVersion) {
            if ("uploaded_pending_validation".equalsIgnoreCase(uploadState)
                    || "validating".equalsIgnoreCase(uploadState)) {
                throw new BizException("TEMPLATE-400", "plugin already publishing");
            }
            return;
        }
        if (!"empty".equalsIgnoreCase(uploadState)) {
            throw new BizException("TEMPLATE-400", "plugin already published");
        }
    }

    private void ensureDeleteAllowed(TemplatePluginManifest manifest) {
        String uploadState = manifest.getUploadState();
        if ("uploaded_pending_validation".equalsIgnoreCase(uploadState)
                || "validating".equalsIgnoreCase(uploadState)) {
            throw new BizException("TEMPLATE-400", "plugin deleting blocked while publishing");
        }
    }

    private long requirePositiveSize(Long size) {
        if (size == null || size <= 0L) {
            throw new BizException("TEMPLATE-400", "size invalid");
        }
        return size;
    }

    private String normalizeOptionalText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private TemplatePluginManifest requireManifest(String pluginId) {
        String normalizedPluginId = templateDomainService.normalizePluginId(pluginId);
        return manifestRepository.findByPluginId(normalizedPluginId)
                .orElseThrow(() -> new BizException("TEMPLATE-404", "plugin manifest not found"));
    }

    private void ensureCreatePermission(String projectId) {
        Long userId = requireUserId();
        if (projectId == null) {
            return;
        }
        ProjectRole role = authzSdk.requireRole(userId, projectId, java.util.Set.of(
                ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER
        ));
        templateDomainService.requireAdminOrOwner(role);
    }

    private void ensureManagePermission(TemplatePluginManifest manifest) {
        Long userId = requireUserId();
        if (manifest.getProjectId() == null) {
            if (!userId.equals(manifest.getOwnerId())) {
                throw new BizException("TEMPLATE-403", "permission denied");
            }
            return;
        }
        ProjectRole role = authzSdk.requireRole(userId, manifest.getProjectId(), java.util.Set.of(
                ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER
        ));
        templateDomainService.requireAdminOrOwner(role);
    }

    private void ensurePreviewPermission(TemplatePluginManifest manifest) {
        Long userId = requireUserId();
        if (manifest.getProjectId() == null) {
            if ("public".equalsIgnoreCase(manifest.getVisibility())) {
                return;
            }
            if (!userId.equals(manifest.getOwnerId())) {
                throw new BizException("TEMPLATE-403", "permission denied");
            }
            return;
        }
        authzSdk.requireRole(userId, manifest.getProjectId(), java.util.Set.of(
                ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER
        ));
    }

    private Long requireUserId() {
        Long userId = CurrentUserContext.getUserId();
        if (userId == null) {
            throw new BizException("TEMPLATE-401", "unauthorized");
        }
        return userId;
    }

    private String normalizeOptionalProjectId(String projectId) {
        String normalized = templateDomainService.normalizeOptional(projectId);
        if (normalized == null) {
            return null;
        }
        return templateDomainService.normalizeKbId(normalized);
    }

    private String normalizeScope(String scope, String projectId) {
        String normalized = templateDomainService.normalizeOptional(scope);
        if (normalized == null) {
            return projectId == null ? "global" : "project";
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (!lower.equals("project") && !lower.equals("global")) {
            throw new BizException("TEMPLATE-400", "scope invalid");
        }
        if (lower.equals("project") && projectId == null) {
            throw new BizException("TEMPLATE-400", "projectId required");
        }
        return lower;
    }

    private String normalizeVisibility(String visibility) {
        String normalized = templateDomainService.normalizeOptional(visibility);
        if (normalized == null) {
            return "project";
        }
        String lower = normalized.toLowerCase(Locale.ROOT);
        if (!lower.equals("private") && !lower.equals("project") && !lower.equals("public")) {
            throw new BizException("TEMPLATE-400", "visibility invalid");
        }
        return lower;
    }

    private boolean equalsIgnoreCase(String left, String right) {
        if (left == null && right == null) {
            return true;
        }
        if (left == null || right == null) {
            return false;
        }
        return left.equalsIgnoreCase(right);
    }

    private String normalizeBaseUrl(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.isEmpty()) {
            return "";
        }
        while (normalized.endsWith("/")) {
            normalized = normalized.substring(0, normalized.length() - 1);
        }
        return normalized;
    }

    private String joinUrl(String base, String path) {
        String normalizedPath = path.startsWith("/") ? path : "/" + path;
        if (base == null || base.isBlank()) {
            return normalizedPath;
        }
        return base + normalizedPath;
    }

    private Map<String, Object> normalizePromptSchema(Map<String, Object> promptSchema) {
        Map<String, Object> normalized = copyMap(promptSchema);
        String toolPrompt = readString(normalized.get("toolPrompt"));
        if (toolPrompt == null || toolPrompt.isBlank()) {
            throw new BizException("TEMPLATE-400", "toolPrompt required");
        }
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("toolPrompt", toolPrompt);
        result.put("flow_custom_prompt", readNullableString(normalized.get("flow_custom_prompt")));
        return result;
    }

    private Map<String, Object> normalizeCapabilities(Map<String, Object> manifest) {
        Object raw = manifest.get("capabilities");
        if (!(raw instanceof Map<?, ?> capabilityMap)) {
            throw new BizException("TEMPLATE-400", "capabilities object required");
        }
        return Map.of(
                "render", readBooleanCapability(capabilityMap, "render"),
                "theme", readBooleanCapability(capabilityMap, "theme"),
                "storage", readBooleanCapability(capabilityMap, "storage"),
                "textEdit", readBooleanCapability(capabilityMap, "textEdit") || readBooleanCapability(capabilityMap, "requestTextEdit"),
                "aiAction", readBooleanCapability(capabilityMap, "aiAction") || readBooleanCapability(capabilityMap, "requestAiAction"),
                "citationJump", readBooleanCapability(capabilityMap, "citationJump") || readBooleanCapability(capabilityMap, "requestCitationJump")
        );
    }

    private boolean readBooleanCapability(Map<?, ?> capabilityMap, String key) {
        Object value = capabilityMap.get(key);
        return value instanceof Boolean bool && bool;
    }

    private String normalizeRelativePath(String path, String requiredMessage) {
        if (path == null || path.isBlank()) {
            if (requiredMessage == null) {
                return null;
            }
            throw new BizException("TEMPLATE-400", requiredMessage);
        }
        String normalized = path.replace('\\', '/').trim();
        while (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }
        if (normalized.startsWith("/")
                || normalized.contains("../")
                || normalized.contains("..\\")
                || normalized.startsWith("http://")
                || normalized.startsWith("https://")) {
            throw new BizException("TEMPLATE-400", "path invalid");
        }
        String[] parts = normalized.split("/");
        List<String> safe = new ArrayList<>();
        for (String part : parts) {
            if (part.isBlank() || ".".equals(part)) {
                continue;
            }
            if ("..".equals(part)) {
                throw new BizException("TEMPLATE-400", "path invalid");
            }
            safe.add(part);
        }
        if (safe.isEmpty()) {
            throw new BizException("TEMPLATE-400", "path invalid");
        }
        return String.join("/", safe);
    }

    private Map<String, Object> readMap(Object value) {
        if (value == null) {
            return Map.of();
        }
        return objectMapper.convertValue(value, MAP_TYPE);
    }

    private Map<String, Object> copyMap(Map<String, Object> source) {
        if (source == null || source.isEmpty()) {
            return Map.of();
        }
        return new LinkedHashMap<>(source);
    }

    private String readString(Object value) {
        if (value == null) {
            return null;
        }
        String normalized = value.toString().trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String readNullableString(Object value) {
        return readString(value);
    }

    private String requireNonBlank(String value, String message) {
        String normalized = templateDomainService.normalizeOptional(value);
        if (normalized == null) {
            throw new BizException("TEMPLATE-400", message);
        }
        return normalized;
    }

    private ValidationCheck check(String code, boolean passed, String message) {
        return new ValidationCheck(code, passed, message);
    }

    private Map<String, Object> createValidationResult(Boolean passed,
                                                       List<String> warnings,
                                                       List<ValidationCheck> checks) {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("passed", passed);
        result.put("warnings", warnings == null ? List.of() : List.copyOf(warnings));
        result.put("checks", checks == null
                ? List.of()
                : checks.stream().map(check -> Map.of(
                        "code", check.code(),
                        "passed", check.passed(),
                        "message", check.message()
                )).toList());
        return result;
    }

    private List<ValidationCheck> appendFailureSummary(List<ValidationCheck> checks, String message) {
        List<ValidationCheck> resolved = new ArrayList<>(checks == null ? List.of() : checks);
        if (message != null && !message.isBlank()) {
            resolved.add(check("VALIDATION_SUMMARY", false, message));
        }
        return resolved;
    }

    private ArtifactValidationException validationFailure(Map<String, Object> sourceManifest,
                                                          List<String> warnings,
                                                          List<ValidationCheck> checks,
                                                          String message) {
        String resolvedMessage = message + ": " + checks.get(checks.size() - 1).message();
        return new ArtifactValidationException(resolvedMessage, sourceManifest, warnings, checks);
    }

    public record CreateCommand(String pluginId, String projectId, String name, String displayName,
                                String sdkVersion, String scope, String visibility,
                                Map<String, Object> promptJsonSchema, Map<String, Object> dataBindingsJson,
                                Map<String, Object> capabilityJson, Map<String, Object> importedManifest) {
    }

    public record UpdateCommand(String name, String displayName, String sdkVersion, String scope,
                                String visibility, Map<String, Object> promptJsonSchema,
                                Map<String, Object> dataBindingsJson, Map<String, Object> capabilityJson) {
    }

    public record PrepareArtifactUploadCommand(Long size, String contentType, boolean replaceCurrentVersion) {
    }

    public record PrepareArtifactUploadResult(TemplatePluginManifest manifest,
                                              String objectKey,
                                              UploadPolicy uploadPolicy) {
    }

    public record ConfirmArtifactUploadCommand(String objectKey,
                                               Long size,
                                               String etag,
                                               boolean replaceCurrentVersion) {
    }

    public record ConfirmArtifactUploadResult(TemplatePluginManifest manifest,
                                              String taskId,
                                              String taskStatus) {
    }

    public record PublishValidationExecutionCommand(String pluginId,
                                                    String objectKey) {
    }

    public record PublishValidationExecutionResult(boolean passed,
                                                   Map<String, Object> result,
                                                   String failureMessage) {
        public static PublishValidationExecutionResult success(Map<String, Object> result) {
            return new PublishValidationExecutionResult(true, result, null);
        }

        public static PublishValidationExecutionResult failed(Map<String, Object> result, String failureMessage) {
            return new PublishValidationExecutionResult(false, result, failureMessage);
        }
    }

    public record ParseManifestResult(Map<String, Object> manifest,
                                      Map<String, Object> normalizedFormValue,
                                      List<String> warnings) {
    }

    public record PreviewEntryResult(String pluginId, String entryUri, String sdkVersion,
                                     Map<String, Object> capabilityJson) {
    }

    public record PreviewAuthorizeResult(String pluginId, String originUrl, String cacheMode) {
    }

    public record PreviewAssetResult(byte[] content,
                                     String contentType,
                                     boolean htmlEntry,
                                     String redirectLocation) {
        public static PreviewAssetResult content(byte[] content, String contentType, boolean htmlEntry) {
            return new PreviewAssetResult(content, contentType, htmlEntry, null);
        }

        public static PreviewAssetResult redirect(String redirectLocation) {
            return new PreviewAssetResult(null, null, false, redirectLocation);
        }

        public boolean isRedirect() {
            return redirectLocation != null && !redirectLocation.isBlank();
        }
    }

    public record ValidationCheck(String code, boolean passed, String message) {
    }

    private record ArtifactBundleValidationResult(Map<String, Object> sourceManifest,
                                                  Map<String, byte[]> entries,
                                                  String entryHtml,
                                                  String assetBaseDir,
                                                  List<String> warnings,
                                                  List<ValidationCheck> checks) {
    }

    private record ZipBundle(Map<String, byte[]> entries) {
    }

    private static final class ArtifactValidationException extends RuntimeException {
        private final Map<String, Object> sourceManifest;
        private final List<String> warnings;
        private final List<ValidationCheck> checks;

        private ArtifactValidationException(String message,
                                            Map<String, Object> sourceManifest,
                                            List<String> warnings,
                                            List<ValidationCheck> checks) {
            super(message);
            this.sourceManifest = sourceManifest;
            this.warnings = warnings;
            this.checks = checks;
        }

        private Map<String, Object> sourceManifest() {
            return sourceManifest;
        }

        private List<String> warnings() {
            return warnings;
        }

        private List<ValidationCheck> checks() {
            return checks;
        }
    }

    public static final class RetryablePublishValidationException extends RuntimeException {
        public RetryablePublishValidationException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
