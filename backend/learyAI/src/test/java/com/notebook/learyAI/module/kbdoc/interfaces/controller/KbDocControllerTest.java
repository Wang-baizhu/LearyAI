// Responsibility: Verify KbDocController endpoint mapping and status fallback behavior.
package com.notebook.learyAI.module.kbdoc.interfaces.controller;

import com.notebook.learyAI.module.kbdoc.application.KbDocAppService;
import com.notebook.learyAI.module.kbdoc.application.UploadPrepareResult;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.shared.storage.TemporaryUrl;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocUpdateRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.TextImportRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UploadPrepareRequest;
import com.notebook.learyAI.module.kbdoc.interfaces.dto.UrlImportResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbDocControllerTest {
    @Mock
    private KbDocAppService appService;

    @InjectMocks
    private KbDocController controller;

    @Test
    @DisplayName("prepare 应映射临时 URL 字段")
    void prepare_shouldMapTemporaryUrl() {
        UploadPrepareRequest request = new UploadPrepareRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        request.setDocId("doc-1");
        request.setFileType("pdf");
        request.setSize(1L);
        request.setPurpose("preview");
        when(appService.prepareUpload("p1", "kb-1", "doc-1", "pdf", 1L, null, "preview"))
                .thenReturn(new UploadPrepareResult("doc-1", "task-1", "obj-1", null,
                        new TemporaryUrl("https://temp", Instant.now().plusSeconds(60))));

        ApiResponse<?> response = controller.prepare(request);

        assertEquals("OK", response.getCode());
        assertEquals("doc-1",
                ((com.notebook.learyAI.module.kbdoc.interfaces.dto.UploadPrepareResponse) response.getData()).getDocId());
    }

    @Test
    @DisplayName("list: 文档状态为空时应回退到 latest status 或 DONE")
    void list_whenStatusBlank_shouldFallbackStatus() {
        KbDoc doc = new KbDoc(1L, "p1", "doc-1", "n", "pdf", 1L, "obj", "minio",
                null, null, "", Instant.now(), Instant.now());
        when(appService.list("p1", null, null, 1, 20, null)).thenReturn(new KbDocPage(List.of(doc), 1, 1, 20));
        when(appService.loadLatestDocStatuses("p1", List.of("doc-1"))).thenReturn(Map.of("doc-1", "PROCESSING"));

        ApiResponse<?> response = controller.list("p1", null, null, 1, 20, null);

        var data = (com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocListResponse) response.getData();
        assertEquals("PROCESSING", data.getItems().get(0).getStatus());
    }

    @Test
    @DisplayName("listOptions 应映射 docId/name/status")
    void listOptions_shouldMapResponse() {
        when(appService.listDocOptions("p1", "doc", null))
                .thenReturn(List.of(new KbDocOption("doc-1", "文档1", "DONE")));

        ApiResponse<?> response = controller.listOptions("p1", "doc", null);

        assertEquals("OK", response.getCode());
        var items = (List<com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocOptionItemResponse>) response.getData();
        assertEquals(1, items.size());
        assertEquals("doc-1", items.get(0).getDocId());
        assertEquals("文档1", items.get(0).getName());
        assertEquals("DONE", items.get(0).getStatus());
    }

    @Test
    @DisplayName("updateDetail 应映射 name/description/documentation")
    void updateDetail_shouldMapResponse() {
        KbDocUpdateRequest request = new KbDocUpdateRequest();
        request.setProjectId("p1");
        request.setName("新文档");
        request.setDescription("新的说明");
        request.setDocumentation(Map.of(
                "version", 1,
                "nodes", List.of(Map.of(
                        "id", "chapter-1",
                        "title", "第一章",
                        "summary", "新的文档",
                        "page_start", 1,
                        "page_end", 2,
                        "children", List.of()
                ))
        ));
        KbDoc doc = new KbDoc(1L, "p1", "doc-1", "新文档", "pdf", 1L, "obj", "minio",
                null, Map.of(
                "description", "新的说明",
                "documentation", Map.of(
                        "version", 1,
                        "nodes", List.of(Map.of(
                                "id", "chapter-1",
                                "title", "第一章",
                                "summary", "新的文档",
                                "page_start", 1,
                                "page_end", 2,
                                "children", List.of()
                        ))
                )
        ), "DONE", Instant.now(), null);
        when(appService.updateDetail("p1", "doc-1", "新文档", "新的说明", request.getDocumentation())).thenReturn(doc);

        ApiResponse<?> response = controller.updateDetail("doc-1", request);

        assertEquals("OK", response.getCode());
        var data = (com.notebook.learyAI.module.kbdoc.interfaces.dto.KbDocDetailResponse) response.getData();
        assertEquals("新文档", data.getName());
        assertEquals("新的说明", data.getMetadata().get("description"));
        assertEquals(1, ((Map<?, ?>) data.getMetadata().get("documentation")).get("version"));
    }

    @Test
    @DisplayName("importText 应映射文本导入请求")
    void importText_shouldMapRequest() {
        TextImportRequest request = new TextImportRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        request.setText("这是测试文本");
        request.setName("这是测...");
        when(appService.importText("p1", "kb-1", "这是测试文本", "这是测..."))
                .thenReturn(new UrlImportResponse("doc-1", "task-2", "PROCESSING"));

        ApiResponse<?> response = controller.importText(request);

        assertEquals("OK", response.getCode());
        assertEquals("doc-1", ((UrlImportResponse) response.getData()).getDocId());
    }
}
