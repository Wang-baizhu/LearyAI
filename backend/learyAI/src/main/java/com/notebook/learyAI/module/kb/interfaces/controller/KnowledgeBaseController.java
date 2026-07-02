// Responsibility: Expose knowledge base endpoints.
package com.notebook.learyAI.module.kb.interfaces.controller;

import com.notebook.learyAI.module.kb.application.KnowledgeBaseAppService;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseCanvasRequest;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseCanvasResponse;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseCreateRequest;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseListResponse;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseResponse;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseUpdateRequest;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseVisitRequest;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/knowledge-bases")
public class KnowledgeBaseController {
    private final KnowledgeBaseAppService knowledgeBaseAppService;

    public KnowledgeBaseController(KnowledgeBaseAppService knowledgeBaseAppService) {
        this.knowledgeBaseAppService = knowledgeBaseAppService;
    }

    @GetMapping
    public ApiResponse<KnowledgeBaseListResponse> list(@RequestParam String projectId,
                                                       @RequestParam(required = false) String search,
                                                       @RequestParam(required = false) String tag,
                                                       @RequestParam(required = false) String sort,
                                                       @RequestParam(required = false) String order,
                                                       @RequestParam(required = false) Integer page,
                                                       @RequestParam(required = false) Integer size) {
        KnowledgeBasePage result = knowledgeBaseAppService.list(projectId, search, tag, sort, order, page, size);
        return ApiResponse.ok("知识库列表查询成功", toListResponse(result));
    }

    @GetMapping("/{kbId}")
    public ApiResponse<KnowledgeBaseResponse> get(@RequestParam String projectId, @PathVariable String kbId) {
        return ApiResponse.ok("知识库详情查询成功", toResponse(knowledgeBaseAppService.getByKbId(projectId, kbId)));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<KnowledgeBaseResponse> create(
            @Valid @RequestBody KnowledgeBaseCreateRequest request) {
        KnowledgeBase created = knowledgeBaseAppService.create(request.getProjectId(), request.getName(),
                request.getDescription(), request.getTags(),
                com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility.from(request.getVisibility()));
        return ApiResponse.ok("知识库创建成功", toResponse(created));
    }

    @PatchMapping("/{kbId}")
    public ApiResponse<KnowledgeBaseResponse> update(@RequestParam String projectId, @PathVariable String kbId,
                                                     @Valid @RequestBody(required = false)
                                                     KnowledgeBaseUpdateRequest request) {
        KnowledgeBaseUpdateRequest payload = request == null ? new KnowledgeBaseUpdateRequest() : request;
        com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility visibility = null;
        if (payload.getVisibility() != null && !payload.getVisibility().isBlank()) {
            visibility = com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility.from(
                    payload.getVisibility());
        }
        KnowledgeBase updated = knowledgeBaseAppService.update(projectId, kbId, payload.getName(),
                payload.getDescription(), payload.getTags(), visibility);
        return ApiResponse.ok("知识库更新成功", toResponse(updated));
    }

    @GetMapping("/{kbId}/canvas")
    public ApiResponse<KnowledgeBaseCanvasResponse> getCanvas(@RequestParam String projectId,
                                                              @PathVariable String kbId) {
        return ApiResponse.ok("知识库画布查询成功",
                new KnowledgeBaseCanvasResponse(knowledgeBaseAppService.getCanvas(projectId, kbId)));
    }

    @PatchMapping("/{kbId}/canvas")
    public ApiResponse<KnowledgeBaseCanvasResponse> updateCanvas(@RequestParam String projectId,
                                                                 @PathVariable String kbId,
                                                                 @RequestBody(required = false)
                                                                 KnowledgeBaseCanvasRequest request) {
        java.util.Map<String, Object> canvas = request == null ? java.util.Map.of() : request.getCanvas();
        return ApiResponse.ok("知识库画布更新成功",
                new KnowledgeBaseCanvasResponse(knowledgeBaseAppService.updateCanvas(projectId, kbId, canvas)));
    }

    @DeleteMapping("/{kbId}")
    public ResponseEntity<Void> delete(@RequestParam String projectId, @PathVariable String kbId) {
        knowledgeBaseAppService.delete(projectId, kbId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/recent")
    public ApiResponse<List<KnowledgeBaseResponse>> recent(@RequestParam String projectId,
                                                           @RequestParam(required = false) Integer limit) {
        List<KnowledgeBase> items = knowledgeBaseAppService.listRecent(projectId, limit);
        List<KnowledgeBaseResponse> responses = new ArrayList<>();
        for (KnowledgeBase kb : items) {
            responses.add(toResponse(kb));
        }
        return ApiResponse.ok("最近知识库查询成功", responses);
    }

    @PostMapping("/{kbId}/visit")
    public ResponseEntity<Void> visit(@RequestParam String projectId, @PathVariable String kbId,
                                      @RequestBody(required = false) KnowledgeBaseVisitRequest request) {
        knowledgeBaseAppService.recordVisit(projectId, kbId, request == null ? null : request.getVisitedAt());
        return ResponseEntity.status(HttpStatus.ACCEPTED).build();
    }

    private KnowledgeBaseListResponse toListResponse(KnowledgeBasePage page) {
        List<KnowledgeBaseResponse> items = new ArrayList<>();
        for (KnowledgeBase kb : page.getItems()) {
            items.add(toResponse(kb));
        }
        return new KnowledgeBaseListResponse(items, page.getTotal(), page.getPage(), page.getSize());
    }

    private KnowledgeBaseResponse toResponse(KnowledgeBase kb) {
        return new KnowledgeBaseResponse(kb.getKbId(), kb.getProjectId(), kb.getName(),
                kb.getDescription(), kb.getTags(), kb.getOwnerId(),
                kb.getVisibility() == null ? null : kb.getVisibility().name(), kb.getVisitedAt());
    }
}
