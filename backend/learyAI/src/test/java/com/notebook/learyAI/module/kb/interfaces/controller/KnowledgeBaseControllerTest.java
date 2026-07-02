// Responsibility: Verify KnowledgeBaseController request/response contract mapping.
package com.notebook.learyAI.module.kb.interfaces.controller;

import com.notebook.learyAI.module.kb.application.KnowledgeBaseAppService;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseCreateRequest;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseCanvasRequest;
import com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseUpdateRequest;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseControllerTest {
    @Mock
    private KnowledgeBaseAppService appService;

    @InjectMocks
    private KnowledgeBaseController controller;

    @Test
    @DisplayName("list 应映射分页响应")
    void list_shouldMapPageResponse() {
        KnowledgeBase kb = kb("kb-1");
        when(appService.list("p1", "s", "t", "updated_at", "desc", 1, 20))
                .thenReturn(new KnowledgeBasePage(List.of(kb), 1, 1, 20));

        ApiResponse<?> response = controller.list("p1", "s", "t", "updated_at", "desc", 1, 20);

        assertEquals("OK", response.getCode());
        com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseListResponse data =
                (com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseListResponse) response.getData();
        assertEquals(1, data.getItems().size());
        assertEquals("kb-1", data.getItems().get(0).getKbId());
    }

    @Test
    @DisplayName("create 应返回 201 并映射详情")
    void create_shouldReturnCreated() {
        KnowledgeBaseCreateRequest request = new KnowledgeBaseCreateRequest();
        request.setProjectId("p1");
        request.setName("kb");
        request.setDescription("d");
        request.setTags(List.of("a"));
        request.setVisibility("PRIVATE");
        when(appService.create("p1", "kb", "d", List.of("a"), KnowledgeBaseVisibility.PRIVATE))
                .thenReturn(kb("kb-1"));

        ApiResponse<?> response = controller.create(request);

        assertEquals("OK", response.getCode());
        assertEquals("kb-1",
                ((com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseResponse) response.getData()).getKbId());
    }

    @Test
    @DisplayName("update 空 body 时应使用空请求并透传")
    void update_whenBodyNull_shouldUseEmptyPayload() {
        when(appService.update("p1", "kb-1", null, null, null, null)).thenReturn(kb("kb-1"));

        ApiResponse<?> response = controller.update("p1", "kb-1", null);

        assertEquals("OK", response.getCode());
        verify(appService).update("p1", "kb-1", null, null, null, null);
    }

    @Test
    @DisplayName("delete/visit 接口应返回约定状态码")
    void deleteAndVisit_shouldReturnExpectedStatus() {
        assertEquals(HttpStatus.NO_CONTENT, controller.delete("p1", "kb-1").getStatusCode());
        assertEquals(HttpStatus.ACCEPTED, controller.visit("p1", "kb-1", null).getStatusCode());
    }

    @Test
    @DisplayName("canvas 读写应映射请求与响应")
    void canvas_shouldMapRequestAndResponse() {
        Map<String, Object> canvas = Map.of("version", 1, "nodes", List.of(), "edges", List.of());
        KnowledgeBaseCanvasRequest request = new KnowledgeBaseCanvasRequest();
        request.setCanvas(canvas);
        when(appService.getCanvas("p1", "kb-1")).thenReturn(canvas);
        when(appService.updateCanvas("p1", "kb-1", canvas)).thenReturn(canvas);

        ApiResponse<?> getResponse = controller.getCanvas("p1", "kb-1");
        ApiResponse<?> updateResponse = controller.updateCanvas("p1", "kb-1", request);

        assertEquals("OK", getResponse.getCode());
        assertEquals(canvas, ((com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseCanvasResponse)
                getResponse.getData()).getCanvas());
        assertEquals(canvas, ((com.notebook.learyAI.module.kb.interfaces.dto.KnowledgeBaseCanvasResponse)
                updateResponse.getData()).getCanvas());
    }

    private KnowledgeBase kb(String kbId) {
        return new KnowledgeBase(1L, kbId, "p1", "name", "d", List.of("a"), 1L,
                KnowledgeBaseVisibility.PRIVATE, Instant.now());
    }
}
