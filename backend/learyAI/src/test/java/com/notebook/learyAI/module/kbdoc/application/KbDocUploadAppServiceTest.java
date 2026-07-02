// Responsibility: Verify kb doc upload app service URL import behavior.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.kbdoc.infrastructure.cache.PreviewStsCache;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.usage.domain.model.UsageAction;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;
import com.notebook.learyAI.module.usage.interfaces.facade.UsageGuard;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.EnumSet;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbDocUploadAppServiceTest {
    @Mock
    private KbDocRepository docRepository;
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    @Mock
    private StorageClient storageClient;
    @Mock
    private PreviewStsCache previewStsCache;
    @Mock
    private KbDocQueryCache kbDocQueryCache;
    @Mock
    private KbDocAppSupport support;
    @Mock
    private KbDocStorageUsageAppService kbDocStorageUsageAppService;
    @Mock
    private UsageGuard usageGuard;

    private KbDocUploadAppService appService;

    @BeforeEach
    void setUp() {
        appService = new KbDocUploadAppService(
                docRepository,
                taskAppService,
                taskStatusService,
                taskWorkflowOrchestrator,
                kbDocStorageUsageAppService,
                usageGuard,
                storageClient,
                previewStsCache,
                kbDocQueryCache,
                support,
                7200,
                "minio"
        );
    }

    @Test
    @DisplayName("prepareUpload: 超出 kbdoc_size 配额时应直接拒绝且不创建任务")
    void prepareUpload_shouldRejectWhenStorageQuotaExceeded() {
        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.requireRole("project-1", 1L)).thenReturn(ProjectRole.OWNER);
        when(support.normalizeRequired("txt", "fileType")).thenReturn("txt");
        when(support.resolvePurpose(null, EnumSet.of(com.notebook.learyAI.shared.storage.TemporaryUrlPurpose.UPLOAD,
                com.notebook.learyAI.shared.storage.TemporaryUrlPurpose.PREVIEW)))
                .thenReturn(com.notebook.learyAI.shared.storage.TemporaryUrlPurpose.UPLOAD);
        when(support.normalizeOptional(null)).thenReturn(null);
        when(usageGuard.check(1L, "project-1", UsageAction.KBDOC_SIZE, 11081L))
                .thenReturn(UsageDecision.deny("USAGE-403", "quota exceeded", "kbdoc_size", 0L, 100L));

        BizException exception = assertThrows(
                BizException.class,
                () -> appService.prepareUpload("project-1", "kb-1", null, "txt", 11081L, null, null)
        );

        assertEquals("USAGE-403", exception.getCode());
        assertEquals("quota exceeded", exception.getMessage());
        verify(taskAppService, never()).createVisibleTask(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("importUrl: URL 导入时应写入 size=0L，避免 kb_doc.size 为空")
    void importUrl_shouldPassZeroSizeToAddDoc() {
        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.requireRole("project-1", 1L)).thenReturn(ProjectRole.OWNER);
        when(support.normalizeRequired("kb-1", "kbId")).thenReturn("kb-1");
        when(support.requireSupportedMediaUrl("https://www.bilibili.com/video/BV1demo"))
                .thenReturn("https://www.bilibili.com/video/BV1demo");
        when(support.requireKbInternalId("project-1", "kb-1", 1L, false)).thenReturn(101L);
        when(support.buildSupportedMediaDocName("https://www.bilibili.com/video/BV1demo", null))
                .thenReturn("Bili_BV1demo_p1");
        when(docRepository.existsByDocId(any(), eq("project-1"))).thenReturn(false);
        when(support.writeMetadata(any())).thenReturn("{\"size\":0}");
        Task task = new Task(11L, "task-11", "project-1", "kb-1", 1L, "document_pipeline", TaskStatus.PROCESSING,
                null, "{\"size\":0}", null, "doc-1", Instant.now(), Instant.now());
        when(taskAppService.createVisibleTask(eq("project-1"), eq("kb-1"), eq(1L), eq("document_pipeline"), any(),
                eq(TaskStatus.PROCESSING), eq("{\"size\":0}"), any())).thenReturn(task);
        KbDoc doc = new KbDoc(22L, "project-1", "doc-1", "Bili_BV1demo_p1", "url", 0L,
                null, "minio", "https://www.bilibili.com/video/BV1demo", null, "PROCESSING", Instant.now(), null);
        when(docRepository.findByDocId(any(), eq("project-1"))).thenReturn(Optional.of(doc));

        appService.importUrl("project-1", "kb-1", "https://www.bilibili.com/video/BV1demo", null);

        ArgumentCaptor<Map<String, Object>> metadataCaptor = ArgumentCaptor.forClass(Map.class);
        verify(support).addDoc(eq("project-1"), any(), metadataCaptor.capture(), eq(TaskStatus.PROCESSING), any());
        assertEquals(0L, metadataCaptor.getValue().get("size"));
        assertEquals("url", metadataCaptor.getValue().get("fileType"));
        assertEquals("Bili_BV1demo_p1", metadataCaptor.getValue().get("name"));
        verify(taskStatusService).publishSnapshot(task, "create");
    }

    @Test
    @DisplayName("importUrl: 非 B 站视频链接应在入口直接拒绝")
    void importUrl_shouldRejectUnsupportedMediaUrl() {
        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.requireRole("project-1", 1L)).thenReturn(ProjectRole.OWNER);
        when(support.normalizeRequired("kb-1", "kbId")).thenReturn("kb-1");
        when(support.requireSupportedMediaUrl("https://example.com/video"))
                .thenThrow(new BizException("KB-400", "仅支持 https://www.bilibili.com/video 开头的链接"));

        BizException exception = assertThrows(
                BizException.class,
                () -> appService.importUrl("project-1", "kb-1", "https://example.com/video", null)
        );

        assertEquals("KB-400", exception.getCode());
        assertEquals("仅支持 https://www.bilibili.com/video 开头的链接", exception.getMessage());
        verify(taskAppService, never()).createVisibleTask(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("importText: 未显式传 name 时应回退为前五个字加省略号")
    void importText_shouldGenerateDefaultNameFromText() {
        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.requireRole("project-1", 1L)).thenReturn(ProjectRole.OWNER);
        when(support.normalizeRequired("kb-1", "kbId")).thenReturn("kb-1");
        when(support.normalizeRequired("这是一个用于测试的纯文本内容", "text")).thenReturn("这是一个用于测试的纯文本内容");
        when(support.requireKbInternalId("project-1", "kb-1", 1L, false)).thenReturn(101L);
        when(docRepository.existsByDocId(any(), eq("project-1"))).thenReturn(false);
        when(support.writeMetadata(any())).thenReturn("{\"sourceType\":\"text\"}");
        Task task = new Task(12L, "task-12", "project-1", "kb-1", 1L, "document_pipeline", TaskStatus.PROCESSING,
                null, "{\"sourceType\":\"text\"}", null, "doc-2", Instant.now(), Instant.now());
        when(taskAppService.createVisibleTask(eq("project-1"), eq("kb-1"), eq(1L), eq("document_pipeline"), any(),
                eq(TaskStatus.PROCESSING), eq("{\"sourceType\":\"text\"}"), any())).thenReturn(task);
        KbDoc doc = new KbDoc(23L, "project-1", "doc-2", "这是一个用...", "txt", 36L,
                null, "minio", null, null, "PROCESSING", Instant.now(), null);
        when(docRepository.findByDocId(any(), eq("project-1"))).thenReturn(Optional.of(doc));

        appService.importText("project-1", "kb-1", "这是一个用于测试的纯文本内容", null);

        ArgumentCaptor<Map<String, Object>> metadataCaptor = ArgumentCaptor.forClass(Map.class);
        verify(support).addDoc(eq("project-1"), any(), metadataCaptor.capture(), eq(TaskStatus.PROCESSING), any());
        assertEquals("text", metadataCaptor.getValue().get("sourceType"));
        assertEquals("txt", metadataCaptor.getValue().get("fileType"));
        assertEquals("这是一个用...", metadataCaptor.getValue().get("name"));
        verify(taskStatusService).publishSnapshot(task, "create");
    }

    @Test
    @DisplayName("confirmUpload: 上传确认后应记录 kbdoc_size 增量")
    void confirmUpload_shouldRecordStorageUsageIncrease() {
        Instant now = Instant.now();
        Task task = new Task(13L, "task-13", "project-1", "kb-1", 1L, "document_pipeline", TaskStatus.UPLOADING,
                null, "{\"size\":128}", null, "doc-3", now, now);
        KbDoc doc = new KbDoc(24L, "project-1", "doc-3", "doc-3", "txt", 128L,
                "obj/project-1/doc-3/file.txt", "minio", null, null, "PROCESSING", now, now);

        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.requireRole("project-1", 1L)).thenReturn(ProjectRole.OWNER);
        when(support.normalizeRequired("doc-3", "docId")).thenReturn("doc-3");
        when(support.normalizeRequired("obj/project-1/doc-3/file.txt", "objectKey"))
                .thenReturn("obj/project-1/doc-3/file.txt");
        when(support.normalizeRequired("kb-1", "kbId")).thenReturn("kb-1");
        when(support.requireKbInternalId("project-1", "kb-1", 1L, false)).thenReturn(101L);
        when(usageGuard.check(1L, "project-1", UsageAction.KBDOC_SIZE, 128L))
                .thenReturn(UsageDecision.allow("kbdoc_size", 0L, 0L));
        when(taskAppService.findLatestDocumentPipelineByDocId("project-1", "doc-3")).thenReturn(Optional.of(task));
        when(support.readMetadata(task.getPipelineContext())).thenReturn(new java.util.HashMap<>(Map.of("size", 128L)));
        when(support.writeMetadata(any())).thenReturn("{\"size\":128}");
        when(docRepository.findByDocId("doc-3", "project-1")).thenReturn(Optional.of(doc));

        appService.confirmUpload("project-1", "doc-3", "obj/project-1/doc-3/file.txt", "etag-1", 128L, "doc", "kb-1");

        verify(usageGuard).check(1L, "project-1", UsageAction.KBDOC_SIZE, 128L);
        verify(kbDocStorageUsageAppService).recordUploadConfirmed(
                1L,
                "project-1",
                "doc-3",
                "obj/project-1/doc-3/file.txt",
                128L,
                13L
        );
    }

    @Test
    @DisplayName("confirmUpload: 超出 kbdoc_size 配额时应拒绝且不推进状态")
    void confirmUpload_shouldRejectWhenStorageQuotaExceeded() {
        Instant now = Instant.now();
        Task task = new Task(13L, "task-13", "project-1", "kb-1", 1L, "document_pipeline", TaskStatus.UPLOADING,
                null, "{\"size\":11081}", null, "doc-3", now, now);

        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("project-1")).thenReturn("project-1");
        when(support.requireRole("project-1", 1L)).thenReturn(ProjectRole.OWNER);
        when(support.normalizeRequired("doc-3", "docId")).thenReturn("doc-3");
        when(support.normalizeRequired("obj/project-1/doc-3/file.txt", "objectKey"))
                .thenReturn("obj/project-1/doc-3/file.txt");
        when(support.normalizeRequired("kb-1", "kbId")).thenReturn("kb-1");
        when(support.requireKbInternalId("project-1", "kb-1", 1L, false)).thenReturn(101L);
        when(taskAppService.findLatestDocumentPipelineByDocId("project-1", "doc-3")).thenReturn(Optional.of(task));
        when(support.readMetadata(task.getPipelineContext())).thenReturn(new java.util.HashMap<>(Map.of("size", 11081L)));
        when(support.writeMetadata(any())).thenReturn("{\"size\":11081}");
        when(usageGuard.check(1L, "project-1", UsageAction.KBDOC_SIZE, 11081L))
                .thenReturn(UsageDecision.deny("USAGE-403", "quota exceeded", "kbdoc_size", 0L, 100L));

        BizException exception = assertThrows(
                BizException.class,
                () -> appService.confirmUpload("project-1", "doc-3", "obj/project-1/doc-3/file.txt", "etag-1", 11081L, "doc", "kb-1")
        );

        assertEquals("USAGE-403", exception.getCode());
        assertEquals("quota exceeded", exception.getMessage());
        verify(taskStatusService, never()).updateStatus(any(), any(), any(), any(), any());
        verify(kbDocStorageUsageAppService, never()).recordUploadConfirmed(any(), any(), any(), any(), anyLong(), any());
    }
}
