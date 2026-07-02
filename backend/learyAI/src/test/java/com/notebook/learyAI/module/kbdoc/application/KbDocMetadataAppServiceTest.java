// Responsibility: Verify kb doc metadata update permission and persistence behavior.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbDocMetadataAppServiceTest {
    @Mock
    private KbDocRepository docRepository;
    @Mock
    private KbDocAppSupport support;
    @Mock
    private KbDocQueryCache kbDocQueryCache;

    private KbDocMetadataAppService appService;

    @BeforeEach
    void setUp() {
        appService = new KbDocMetadataAppService(docRepository, support, kbDocQueryCache);
    }

    @Test
    @DisplayName("updateDetail: 应更新名称并只保留有效 metadata 字段")
    void updateDetail_shouldRewriteEditableMetadata() {
        KbDoc doc = new KbDoc(
                1L,
                "project-1",
                "doc-1",
                "旧名称",
                "pdf",
                100L,
                "obj",
                "minio",
                null,
                Map.of(
                        "description", "旧描述",
                        "documentation", Map.of(
                                "version", 1,
                                "nodes", List.of()
                        ),
                        "tag", "keep"
                ),
                "DONE",
                Instant.now(),
                null
        );
        KbDoc updated = new KbDoc(
                1L,
                "project-1",
                "doc-1",
                "新名称",
                "pdf",
                100L,
                "obj",
                "minio",
                null,
                Map.of(
                        "documentation", Map.of(
                                "version", 1,
                                "nodes", List.of(Map.of(
                                        "id", "chapter-1",
                                        "title", "第一章",
                                        "summary", "新文档",
                                        "page_start", 1,
                                        "page_end", 2,
                                        "children", List.of()
                                ))
                        ),
                        "tag", "keep"
                ),
                "DONE",
                Instant.now(),
                null
        );

        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.normalizeRequired("doc-1", "docId")).thenReturn("doc-1");
        when(support.normalizeRequired("新名称", "name")).thenReturn("新名称");
        when(support.normalizeOptional("   ")).thenReturn(null);
        when(docRepository.findByDocId("doc-1", "project-1")).thenReturn(Optional.of(doc));
        when(support.writeMetadata(Map.of(
                "documentation", Map.of(
                        "version", 1,
                        "nodes", List.of(Map.of(
                                "id", "chapter-1",
                                "title", "第一章",
                                "summary", "新文档",
                                "page_start", 1,
                                "page_end", 2,
                                "children", List.of()
                        ))
                ),
                "tag", "keep"
        ))).thenReturn("{\"documentation\":{\"version\":1,\"nodes\":[{\"id\":\"chapter-1\",\"title\":\"第一章\",\"summary\":\"新文档\",\"page_start\":1,\"page_end\":2,\"children\":[]}]},\"tag\":\"keep\"}");
        when(docRepository.updateDetailByDocId(
                "project-1",
                "doc-1",
                "新名称",
                "{\"documentation\":{\"version\":1,\"nodes\":[{\"id\":\"chapter-1\",\"title\":\"第一章\",\"summary\":\"新文档\",\"page_start\":1,\"page_end\":2,\"children\":[]}]},\"tag\":\"keep\"}"
        )).thenReturn(updated);

        KbDoc result = appService.updateDetail(
                "project-1",
                "doc-1",
                "新名称",
                "   ",
                Map.of(
                        "version", 1,
                        "nodes", List.of(Map.of(
                                "id", " chapter-1 ",
                                "title", " 第一章 ",
                                "summary", " 新文档 ",
                                "page_start", 1,
                                "page_end", 2,
                                "children", List.of()
                        ))
                )
        );

        assertEquals("新名称", result.getName());
        assertEquals(1, ((Map<?, ?>) result.getMetadata().get("documentation")).get("version"));
        verify(support).requireWriteRole("project-1", 1L);
        verify(kbDocQueryCache).evictDoc("project-1", 1L, "doc-1");
    }

    @Test
    @DisplayName("updateDetail: 无写权限时应返回 KB-403")
    void updateDetail_withoutWriteRole_shouldThrowKb403() {
        when(support.requireUserId()).thenReturn(2L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.requireWriteRole("project-1", 2L)).thenThrow(new BizException("KB-403", "permission denied"));

        BizException exception = assertThrows(
                BizException.class,
                () -> appService.updateDetail("project-1", "doc-1", "名称", null, null)
        );

        assertEquals("KB-403", exception.getCode());
        verify(docRepository, never()).findByDocId(anyString(), eq("project-1"));
    }

    @Test
    @DisplayName("updateDetail: documentation 非法树结构时应拒绝")
    void updateDetail_withInvalidDocumentation_shouldThrowKb400() {
        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.normalizeRequired("doc-1", "docId")).thenReturn("doc-1");
        when(support.normalizeRequired("名称", "name")).thenReturn("名称");

        BizException exception = assertThrows(
                BizException.class,
                () -> appService.updateDetail(
                        "project-1",
                        "doc-1",
                        "名称",
                        null,
                        Map.of("version", 1)
                )
        );

        assertEquals("KB-400", exception.getCode());
        assertEquals("documentation.nodes required", exception.getMessage());
        verify(docRepository, never()).findByDocId(anyString(), eq("project-1"));
    }
}
