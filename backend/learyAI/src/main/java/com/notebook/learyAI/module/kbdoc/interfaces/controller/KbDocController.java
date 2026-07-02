// Responsibility: Expose knowledge base document endpoints.
package com.notebook.learyAI.module.kbdoc.interfaces.controller;

import com.notebook.learyAI.module.kbdoc.application.KbDocAppService;
import com.notebook.learyAI.module.kbdoc.application.UploadConfirmResult;
import com.notebook.learyAI.module.kbdoc.application.UploadPrepareResult;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunk;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.storage.UploadPolicy;
import com.notebook.learyAI.shared.storage.StsCredentials;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocDetailResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocBindRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocItemResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocListResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocOptionItemResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocTextChunkItemResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocTextChunkPageResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocUpdateRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.PreviewCredentialsRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.PreviewCredentialsResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.TextImportRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UploadConfirmRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UploadConfirmResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UploadPolicyResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UploadPrepareRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UploadPrepareResponse;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UrlImportRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UrlImportResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/kb")
public class KbDocController {
    private final KbDocAppService kbDocAppService;

    public KbDocController(KbDocAppService kbDocAppService) {
        this.kbDocAppService = kbDocAppService;
    }

    @PostMapping("/docs/upload/prepare")
    public ApiResponse<UploadPrepareResponse> prepare(@Valid @RequestBody UploadPrepareRequest request) {
        UploadPrepareResult result = kbDocAppService.prepareUpload(
                request.getProjectId(), request.getKbId(), request.getDocId(), request.getFileType(),
                request.getSize(), request.getHash(), request.getPurpose());
        UploadPolicy policy = result.getUploadPolicy();
        UploadPolicyResponse policyResponse = policy == null ? null
                : new UploadPolicyResponse(policy.getProvider(), policy.getUploadUrl(), policy.getMethod(),
                policy.getHeaders(), policy.getFields(), policy.getExpiresAt());
        String tempUrl = result.getTemporaryUrl() == null ? null : result.getTemporaryUrl().getUrl();
        java.time.Instant tempUrlExpiresAt = result.getTemporaryUrl() == null ? null
                : result.getTemporaryUrl().getExpiresAt();
        return ApiResponse.ok("文档上传准备成功",
                new UploadPrepareResponse(result.getDocId(), result.getTaskId(), result.getObjectKey(),
                        policyResponse, tempUrl, tempUrlExpiresAt));
    }

    @PostMapping("/docs/upload/confirm")
    public ApiResponse<UploadConfirmResponse> confirm(@Valid @RequestBody UploadConfirmRequest request) {
        UploadConfirmResult result = kbDocAppService.confirmUpload(
                request.getProjectId(), request.getDocId(), request.getObjectKey(), request.getEtag(),
                request.getSize(), request.getName(), request.getKbId());
        return ApiResponse.ok("文档上传确认成功", new UploadConfirmResponse(result.getTaskId(), result.getStatus()));
    }

    @PostMapping("/docs/import/url")
    public ApiResponse<UrlImportResponse> importUrl(@Valid @RequestBody UrlImportRequest request) {
        UrlImportResponse result = kbDocAppService.importUrl(
                request.getProjectId(), request.getKbId(), request.getUrl(), request.getName());
        return ApiResponse.ok("链接导入成功", result);
    }

    @PostMapping("/docs/import/text")
    public ApiResponse<UrlImportResponse> importText(@Valid @RequestBody TextImportRequest request) {
        UrlImportResponse result = kbDocAppService.importText(
                request.getProjectId(), request.getKbId(), request.getText(), request.getName());
        return ApiResponse.ok("文本导入成功", result);
    }

    @PostMapping("/docs/preview/credentials")
    public ApiResponse<PreviewCredentialsResponse> previewCredentials(
            @Valid @RequestBody PreviewCredentialsRequest request) {
        StsCredentials credentials = kbDocAppService.issuePreviewCredentials(request.getProjectId(), request.getDocId());
        PreviewCredentialsResponse response = new PreviewCredentialsResponse(
                credentials.getProvider(),
                credentials.getAccessKeyId(),
                credentials.getSecretAccessKey(),
                credentials.getSessionToken(),
                credentials.getExpiresAt(),
                credentials.getEndpoint(),
                credentials.getBucket(),
                credentials.getPrefix()
        );
        return ApiResponse.ok("文档预览凭证获取成功", response);
    }

    @GetMapping({"/recent", "/docs/recent"})
    public ApiResponse<List<String>> recent(@RequestParam String projectId,
                                            @RequestParam(required = false) Integer limit) {
        return ApiResponse.ok("最近文档查询成功", kbDocAppService.listRecentIds(projectId, limit));
    }

    @GetMapping("/docs")
    public ApiResponse<KbDocListResponse> list(@RequestParam String projectId,
                                               @RequestParam(required = false) String search,
                                               @RequestParam(required = false) String fileType,
                                               @RequestParam(required = false) Integer page,
                                               @RequestParam(required = false) Integer size,
                                               @RequestParam(required = false) String kbId) {
        KbDocPage result = kbDocAppService.list(projectId, search, fileType, page, size, kbId);
        List<String> docIds = result.getItems().stream()
                .filter(doc -> doc.getStatus() == null || doc.getStatus().isBlank())
                .map(KbDoc::getDocId)
                .collect(Collectors.toList());
        Map<String, String> statuses = docIds.isEmpty()
                ? java.util.Map.of()
                : kbDocAppService.loadLatestDocStatuses(projectId, docIds);
        List<KbDocItemResponse> items = new ArrayList<>();
        for (KbDoc doc : result.getItems()) {
            String status = doc.getStatus();
            if (status == null || status.isBlank()) {
                status = statuses.getOrDefault(doc.getDocId(), TaskStatus.DONE.name());
            }
            items.add(new KbDocItemResponse(doc.getDocId(), doc.getName(), doc.getFileType(),
                    doc.getSize(), doc.getCreatedAt(), status));
        }
        return ApiResponse.ok("文档列表查询成功",
                new KbDocListResponse(items, result.getTotal(), result.getPage(), result.getSize()));
    }

    @GetMapping("/docs/options")
    public ApiResponse<List<KbDocOptionItemResponse>> listOptions(@RequestParam String projectId,
                                                                  @RequestParam(required = false) String search,
                                                                  @RequestParam(required = false) String kbId) {
        List<KbDocOption> options = kbDocAppService.listDocOptions(projectId, search, kbId);
        List<KbDocOptionItemResponse> items = options.stream()
                .map(item -> new KbDocOptionItemResponse(item.getDocId(), item.getName(), item.getStatus()))
                .collect(Collectors.toList());
        return ApiResponse.ok("文档选项列表查询成功", items);
    }

    @GetMapping("/docs/{docId}")
    public ApiResponse<KbDocDetailResponse> detail(@RequestParam String projectId, @PathVariable String docId) {
        KbDoc doc = kbDocAppService.getByDocId(projectId, docId);
        KbDocDetailResponse response = new KbDocDetailResponse(doc.getDocId(), doc.getName(),
                doc.getFileType(), doc.getSize(), doc.getObjectKey(), doc.getStorageProvider(), doc.getOriginUrl(),
                doc.getMetadata(), doc.getCreatedAt(), doc.getUpdatedAt());
        return ApiResponse.ok("文档详情查询成功", response);
    }

    @PatchMapping("/docs/{docId}")
    public ApiResponse<KbDocDetailResponse> updateDetail(@PathVariable String docId,
                                                         @Valid @RequestBody KbDocUpdateRequest request) {
        KbDoc doc = kbDocAppService.updateDetail(
                request.getProjectId(),
                docId,
                request.getName(),
                request.getDescription(),
                request.getDocumentation()
        );
        KbDocDetailResponse response = new KbDocDetailResponse(doc.getDocId(), doc.getName(),
                doc.getFileType(), doc.getSize(), doc.getObjectKey(), doc.getStorageProvider(), doc.getOriginUrl(),
                doc.getMetadata(), doc.getCreatedAt(), doc.getUpdatedAt());
        return ApiResponse.ok("文档更新成功", response);
    }

    @GetMapping("/docs/{docId}/text-chunks")
    public ApiResponse<KbDocTextChunkPageResponse> listTextChunks(@RequestParam String projectId,
                                                                  @PathVariable String docId,
                                                                  @RequestParam(required = false) Integer startChunkSec,
                                                                  @RequestParam(required = false) Integer size) {
        KbDocTextChunkPage page = kbDocAppService.listTextChunks(projectId, docId, startChunkSec, size);
        List<KbDocTextChunkItemResponse> items = page.getItems().stream()
                .map(this::toTextChunkItemResponse)
                .collect(Collectors.toList());
        return ApiResponse.ok("文档文本分片查询成功",
                new KbDocTextChunkPageResponse(items, page.isHasMore(), page.getNextChunkSec()));
    }

    @DeleteMapping("/docs/{docId}")
    public ApiResponse<Boolean> delete(@RequestParam String projectId, @PathVariable String docId) {
        kbDocAppService.deleteByDocId(projectId, docId);
        return ApiResponse.ok("文档删除成功", Boolean.TRUE);
    }

    @PostMapping("/docs/bind")
    public ApiResponse<Boolean> bind(@Valid @RequestBody KbDocBindRequest request) {
        kbDocAppService.bindDoc(request.getProjectId(), request.getDocId(), request.getKbId());
        return ApiResponse.ok("文档绑定知识库成功", Boolean.TRUE);
    }

    @DeleteMapping("/docs/bind")
    public ApiResponse<Boolean> unbind(@Valid @RequestBody KbDocBindRequest request) {
        kbDocAppService.unbindDoc(request.getProjectId(), request.getDocId(), request.getKbId());
        return ApiResponse.ok("文档解绑知识库成功", Boolean.TRUE);
    }

    private KbDocTextChunkItemResponse toTextChunkItemResponse(KbDocTextChunk chunk) {
        return new KbDocTextChunkItemResponse(chunk.getChunkSec(), chunk.getText());
    }
}
