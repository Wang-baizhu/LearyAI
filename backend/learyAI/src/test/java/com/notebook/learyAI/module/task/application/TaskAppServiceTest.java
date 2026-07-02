// Responsibility: Verify TaskAppService creation, metadata parsing and publish behavior.
package com.notebook.learyAI.module.task.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.domain.repository.TaskRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskAppServiceTest {
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private TaskMqPublisher taskMqPublisher;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("createTask: 应保存任务并返回仓储结果")
    void createTask_shouldSaveTask() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        Task saved = visibleTask(1L, "task-1", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{}", null, null, Instant.now());
        when(taskRepository.save(any(Task.class))).thenReturn(saved);

        Task result = appService.createVisibleTask("p1", "kb-1", 2L, "doc", "d1",
                TaskStatus.UPLOADING, "{}", Instant.now());

        assertEquals(1L, result.getTaskRecordId());
        ArgumentCaptor<Task> captor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(captor.capture());
        assertEquals("p1", captor.getValue().getProjectId());
    }

    @Test
    @DisplayName("createTask: pptprompt_pipeline 应允许 projectId 和 kbId 为空")
    void createTask_whenPptPromptPipeline_shouldAllowNullScope() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Task task = appService.createVisibleTask(null, null, 2L, TaskTypes.PPTPROMPT_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"promptMarkdown\":\"body_1\"}", Instant.now());

        assertEquals(null, task.getProjectId());
        assertEquals(null, task.getKbId());
    }

    @Test
    @DisplayName("createTask: document pipeline 不应再初始化 docRef")
    void createTask_shouldInitializeDocumentViewData() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Task task = appService.createVisibleTask("p1", "kb-1", 2L, TaskTypes.DOCUMENT_PIPELINE, "doc-1",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\",\"name\":\"文档A\"}", Instant.now());

        Map<String, Object> viewData = appService.readViewData(task);
        assertTrue(viewData.isEmpty());
    }

    @Test
    @DisplayName("createTask: template pipeline 应初始化 viewData.docRefs")
    void createTask_shouldInitializeTemplateViewData() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Task task = appService.createVisibleTask("p1", "kb-1", 2L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.PROCESSING,
                "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-a1\",\"pluginId\":\"quiz\",\"docRefs\":[{\"id\":\"doc-1\",\"name\":\"文档A\"},{\"id\":\"doc-2\",\"name\":\"文档B\"}]}",
                Instant.now());

        Map<String, Object> viewData = appService.readViewData(task);
        assertTrue(viewData.containsKey("docRefs"));
        assertTrue(!viewData.containsKey("docRef"));
    }

    @Test
    @DisplayName("readJsonMap: 空值返回空 Map，非法 JSON 返回 KB-500")
    void readJsonMap_shouldHandleBlankAndInvalidJson() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        assertEquals(Map.of(), appService.readJsonMap("  "));

        BizException ex = assertThrows(BizException.class, () -> appService.readJsonMap("{bad-json}"));
        assertEquals("KB-500", ex.getCode());
    }

    @Test
    @DisplayName("publishTaskCreated: 非事务下应直接发布")
    void publishTaskCreated_withoutTransaction_shouldPublishDirectly() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        Task task = visibleTask(1L, "task-1", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{}", null, null, Instant.now());

        appService.publishTaskCreated(task, Map.of("k", "v"));

        verify(taskMqPublisher).publishTaskCreated(task, Map.of("k", "v"));
    }

    @Test
    @DisplayName("publishTaskCreated: 事务中应注册 afterCommit 回调，提交前不发布")
    void publishTaskCreated_withTransaction_shouldPublishAfterCommit() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        Task task = visibleTask(1L, "task-1", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{}", null, null, Instant.now());

        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            appService.publishTaskCreated(task, Map.of("k", "v"));
            verifyNoInteractions(taskMqPublisher);

            List<TransactionSynchronization> synchronizations = TransactionSynchronizationManager.getSynchronizations();
            assertEquals(1, synchronizations.size());
            synchronizations.get(0).afterCommit();
            verify(taskMqPublisher).publishTaskCreated(task, Map.of("k", "v"));
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("查询接口应透传参数并返回仓储结果")
    void queryApis_shouldDelegateToRepository() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        Task task = visibleTask(8L, "task-8", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.DONE,
                "{}", null, null, Instant.now());
        TaskPage page = new TaskPage(List.of(task), 1, 1, 1);
        when(taskRepository.findLatestByTypeAndTypeId("p1", "doc", "d1")).thenReturn(java.util.Optional.of(task));
        when(taskRepository.findLatestDocumentPipelineByDocId("p1", "d1")).thenReturn(java.util.Optional.of(task));
        when(taskRepository.findById(8L, "p1")).thenReturn(java.util.Optional.of(task));
        when(taskRepository.findVisibleByPublicTaskId("task-8", "p1")).thenReturn(java.util.Optional.of(task));
        when(taskRepository.findByProjectAndKbIdAndTypesAndStatuses("p1", "kb-1", List.of("doc"), List.of("PROCESSING"), 1, 20))
                .thenReturn(page);
        when(taskRepository.findByTypeAndStatusAndUpdatedAtBefore("doc", TaskStatus.PROCESSING, Instant.EPOCH))
                .thenReturn(List.of(task));

        assertSame(task, appService.findLatestByTypeAndTypeId("p1", "doc", "d1").orElseThrow());
        assertSame(task, appService.findLatestDocumentPipelineByDocId("p1", "d1").orElseThrow());
        assertSame(task, appService.findById(8L, "p1").orElseThrow());
        assertSame(task, appService.findVisibleByPublicTaskId("task-8", "p1").orElseThrow());
        assertSame(page, appService.findByProjectAndKbIdAndTypesAndStatuses("p1", "kb-1", List.of("doc"),
                List.of(TaskStatus.PROCESSING), 1, 20));
        assertEquals(1, appService.findByTypeAndStatusAndUpdatedAtBefore("doc", TaskStatus.PROCESSING, Instant.EPOCH).size());
    }

    @Test
    @DisplayName("deleteByIdAndProjectId 应透传删除参数")
    void deleteByIdAndProjectId_shouldDelegate() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);

        appService.deleteByIdAndProjectId(9L, "p9");

        verify(taskRepository).deleteByIdAndProjectId(9L, "p9");
    }

    @Test
    @DisplayName("终态可见任务查询与按 taskId 删除阶段执行应透传参数")
    void retentionQueries_shouldDelegate() {
        TaskAppService appService = new TaskAppService(taskRepository, taskMqPublisher, objectMapper);
        Task task = visibleTask(10L, "task-10", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.DONE,
                "{}", null, null, Instant.now());
        when(taskRepository.findVisibleByStatusesAndUpdatedAtBefore(List.of(TaskStatus.DONE, TaskStatus.FAILED), Instant.EPOCH))
                .thenReturn(List.of(task));

        assertEquals(1, appService.findVisibleByStatusesAndUpdatedAtBefore(
                List.of(TaskStatus.DONE, TaskStatus.FAILED), Instant.EPOCH
        ).size());
    }

    @Test
    @DisplayName("publishTaskCreated: publisher 为空时应忽略")
    void publishTaskCreated_whenPublisherNull_shouldIgnore() {
        TaskAppService appService = new TaskAppService(taskRepository, null, objectMapper);
        Task task = visibleTask(1L, "task-1", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{}", null, null, Instant.now());
        appService.publishTaskCreated(task, Map.of("k", "v"));
        verifyNoInteractions(taskRepository);
    }

    private Task visibleTask(Long taskRecordId, String publicTaskId, String projectId, String kbId, Long userId,
                             String type, String typeId, TaskStatus status, String pipelineContext,
                             String currentStage, String viewData, Instant now) {
        return new Task(taskRecordId, publicTaskId, projectId, kbId, userId, type, status,
                currentStage, pipelineContext, viewData, typeId, now, now);
    }
}
