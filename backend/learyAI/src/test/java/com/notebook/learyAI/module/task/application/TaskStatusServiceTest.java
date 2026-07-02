// Responsibility: Verify TaskStatusService validation, no-op branch and status update publish flow.
package com.notebook.learyAI.module.task.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.push.TenantPushRegistry;
import com.notebook.learyAI.module.task.application.push.dto.TaskPushEvent;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.status.TaskStatusListener;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.domain.repository.StageExecutionRepository;
import com.notebook.learyAI.module.task.domain.repository.TaskRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@ExtendWith(MockitoExtension.class)
class TaskStatusServiceTest {
    @Mock
    private TaskRepository taskRepository;
    @Mock
    private StageExecutionRepository stageExecutionRepository;
    @Mock
    private TenantPushRegistry pushRegistry;
    @Mock
    private TaskStatusListener listener;

    @Test
    @DisplayName("updateStatus: taskId 为空应返回 KB-400")
    void updateStatus_whenTaskIdNull_shouldThrowKb400() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());

        BizException ex = assertThrows(BizException.class,
                () -> service.updateStatus(null, "p1", TaskStatus.DONE, "{}", "manual"));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("updateTaskStatus: 状态和 metadata 不变应返回 Optional.empty")
    void updateTaskStatus_whenNoChange_shouldReturnEmpty() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());
        Task current = visibleTask(1L, "task-1", "p1", null, 2L, "doc", "d1", TaskStatus.DONE,
                "{\"k\":\"v\"}", null, "{\"k\":\"v\"}", Instant.now());
        when(taskRepository.findById(1L, "p1")).thenReturn(Optional.of(current));

        Optional<?> result = service.updateTaskStatus(1L, "p1", TaskStatus.DONE,
                null, null, "manual");

        assertTrue(result.isEmpty());
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    @DisplayName("updateTaskStatus: 状态变化时应保存、通知 listener 并广播")
    void updateTaskStatus_whenChanged_shouldSaveNotifyAndBroadcast() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());
        Instant now = Instant.now();
        Task current = visibleTask(1L, "task-1", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{\"kbId\":\"kb-1\"}", "doc:main", null, now);
        Task saved = current.withState(TaskStatus.DONE, "{\"kbId\":\"kb-1\",\"info\":\"ok\"}", "doc:main",
                "{\"info\":\"ok\"}", now.plusSeconds(1));
        when(taskRepository.findById(1L, "p1")).thenReturn(Optional.of(current));
        when(taskRepository.save(any(Task.class))).thenReturn(saved);

        Optional<?> result = service.updateTaskStatus(1L, "p1", TaskStatus.DONE,
                Map.of(), "ok", "manual");

        assertTrue(result.isPresent());
        verify(listener).onStatusChanged(saved, TaskStatus.UPLOADING, "manual");
        ArgumentCaptor<com.notebook.learyAI.module.task.application.push.dto.TaskPushEvent> eventCaptor =
                ArgumentCaptor.forClass(com.notebook.learyAI.module.task.application.push.dto.TaskPushEvent.class);
        verify(pushRegistry).broadcast(org.mockito.ArgumentMatchers.eq("p1"), org.mockito.ArgumentMatchers.eq("kb-1"),
                org.mockito.ArgumentMatchers.eq(2L), eventCaptor.capture());
        assertEquals("DONE", eventCaptor.getValue().getStatus());
        assertEquals("doc:main", eventCaptor.getValue().getCurrentStage());
        assertEquals(Map.of("info", "ok"), eventCaptor.getValue().getViewData());
    }

    @Test
    @DisplayName("updateStatus: 任务不存在时应返回 KB-404")
    void updateStatus_whenTaskMissing_shouldThrowKb404() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());
        when(taskRepository.findById(99L, "p1")).thenReturn(Optional.empty());

        BizException ex = assertThrows(BizException.class,
                () -> service.updateStatus(99L, "p1", TaskStatus.DONE, "{}", "manual"));

        assertEquals("KB-404", ex.getCode());
    }

    @Test
    @DisplayName("updateTaskStatus: metadata 非法 JSON 且有更新时应返回 KB-500")
    void updateTaskStatus_whenMetadataInvalid_shouldThrowKb500() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());
        Instant now = Instant.now();
        Task current = visibleTask(1L, "task-1", "p1", null, 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{bad-json}", null, "{bad-json}", now);
        when(taskRepository.findById(1L, "p1")).thenReturn(Optional.of(current));

        BizException ex = assertThrows(BizException.class,
                () -> service.updateTaskStatus(1L, "p1", TaskStatus.DONE,
                        Map.of("k", "v"), null, "manual"));

        assertEquals("KB-500", ex.getCode());
        verify(taskRepository, never()).save(any(Task.class));
    }

    @Test
    @DisplayName("updateTaskStatus: metadata updates+info 应合并并写入事件字段")
    void updateTaskStatus_whenMergeMetadata_shouldSaveMergedAndBroadcastEvent() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());
        Instant now = Instant.now();
        Task current = visibleTask(1L, "task-1", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.PROCESSING,
                "{\"a\":1,\"kbId\":\"kb-1\"}", null, "{\"a\":1}", now);
        Task saved = current.withState(TaskStatus.DONE, "{\"a\":1,\"kbId\":\"kb-1\"}", null,
                "{\"a\":2,\"b\":3,\"info\":\"finish\"}", now.plusSeconds(1));
        when(taskRepository.findById(1L, "p1")).thenReturn(Optional.of(current));
        when(taskRepository.save(any(Task.class))).thenReturn(saved);

        Optional<TaskPushEvent> result = service.updateTaskStatus(
                1L, "p1", TaskStatus.DONE, Map.of("a", 2, "b", 3),
                " finish ", "manual"
        );

        assertTrue(result.isPresent());
        assertEquals("DONE", result.get().getStatus());
        assertEquals("finish", String.valueOf(result.get().getViewData().get("info")));
        assertEquals("manual", result.get().getChangeType());
        assertEquals("2", String.valueOf(result.get().getViewData().get("a")));
    }

    @Test
    @DisplayName("updateTaskStatus: 事务中应 afterCommit 才广播")
    void updateTaskStatus_withTransaction_shouldBroadcastAfterCommit() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());
        Instant now = Instant.now();
        Task current = visibleTask(1L, "task-1", "p1", "kb-1", 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{\"kbId\":\"kb-1\"}", null, null, now);
        Task saved = current.withState(TaskStatus.DONE, "{\"kbId\":\"kb-1\",\"info\":\"ok\"}", null,
                "{\"info\":\"ok\"}", now.plusSeconds(1));
        when(taskRepository.findById(1L, "p1")).thenReturn(Optional.of(current));
        when(taskRepository.save(any(Task.class))).thenReturn(saved);

        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            service.updateTaskStatus(1L, "p1", TaskStatus.DONE, Map.of(), "ok", "manual");
            verifyNoInteractions(pushRegistry);
            List<TransactionSynchronization> syncs = TransactionSynchronizationManager.getSynchronizations();
            assertEquals(1, syncs.size());
            syncs.get(0).afterCommit();
            verify(pushRegistry).broadcast(org.mockito.ArgumentMatchers.eq("p1"), org.mockito.ArgumentMatchers.eq("kb-1"),
                    org.mockito.ArgumentMatchers.eq(2L), any(TaskPushEvent.class));
        } finally {
            TransactionSynchronizationManager.setActualTransactionActive(false);
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    @DisplayName("updateTaskStatus: metadata 序列化失败应返回 KB-500")
    void updateTaskStatus_whenMetadataSerializeFailed_shouldThrowKb500() throws Exception {
        ObjectMapper mapper = org.mockito.Mockito.mock(ObjectMapper.class);
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                mapper);
        Instant now = Instant.now();
        Task current = visibleTask(1L, "task-1", "p1", null, 2L, "doc", "d1", TaskStatus.UPLOADING,
                "{}", null, "{}", now);
        when(taskRepository.findById(1L, "p1")).thenReturn(Optional.of(current));
        when(mapper.readValue(org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(new java.util.HashMap<>());
        doThrow(new JsonProcessingException("boom") {}).when(mapper).writeValueAsString(any(Map.class));

        BizException ex = assertThrows(BizException.class, () -> service.updateTaskStatus(
                1L, "p1", TaskStatus.DONE, Map.of("k", "v"), null, "manual"
        ));
        assertEquals("KB-500", ex.getCode());
    }

    @Test
    @DisplayName("applyStageStatus: 内部阶段状态更新应只写 execution 不广播 SSE")
    void applyStageStatus_whenInternalStageDone_shouldNotBroadcast() {
        TaskStatusService service = new TaskStatusService(taskRepository, stageExecutionRepository, pushRegistry,
                List.of(listener), new ObjectMapper());
        Instant now = Instant.now();
        StageExecution current = stageExecution(2L, 1L, "agent:summary", TaskTypes.AGENT,
                "kbsummary", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}", null, null, now);
        StageExecution saved = current.withState(TaskStatus.DONE, current.getInputJson(), "{\"summary\":\"ok\"}",
                null, 1, current.getStartedAt(), now.plusSeconds(1), now.plusSeconds(1));
        when(stageExecutionRepository.findById(2L)).thenReturn(Optional.of(current));
        when(stageExecutionRepository.save(any(StageExecution.class))).thenReturn(saved);

        Optional<TaskStatusService.StageStatusApplyResult> result = service.applyStageStatus(
                2L, TaskStatus.DONE, Map.of("summary", "ok"), null, null, null, "status_change"
        );

        assertTrue(result.isPresent());
        assertEquals(TaskStatus.DONE, result.get().stageExecution().getStatus());
        verifyNoInteractions(pushRegistry);
        verifyNoInteractions(taskRepository);
    }

    @Test
    @DisplayName("applyStageStatus: 阶段 PROCESSING 且无实际变更时应返回空")
    void applyStageStatus_whenInternalProcessingWithoutChange_shouldReturnEmpty() {
        TaskStatusService service = new TaskStatusService(taskRepository, stageExecutionRepository, pushRegistry,
                List.of(listener), new ObjectMapper());
        Instant now = Instant.now();
        StageExecution current = stageExecution(3L, 1L, "agent:mindmap", TaskTypes.AGENT,
                "mindmap", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}", null, null, now);
        when(stageExecutionRepository.findById(3L)).thenReturn(Optional.of(current));

        Optional<TaskStatusService.StageStatusApplyResult> result = service.applyStageStatus(
                3L, TaskStatus.PROCESSING, null, "正在生成导图中...", null, null, "status_change"
        );

        assertTrue(result.isEmpty());
        verify(stageExecutionRepository, never()).save(any(StageExecution.class));
    }

    @Test
    @DisplayName("updateTaskStatus: 可见任务失败时应写入 viewData.failedReason")
    void updateTaskStatus_whenVisibleFailed_shouldWriteFailedReason() {
        TaskStatusService service = new TaskStatusService(taskRepository, pushRegistry, List.of(listener),
                new ObjectMapper());
        Instant now = Instant.now();
        Task current = visibleTask(4L, "task-4", "p1", "kb-1", 2L, TaskTypes.DOCUMENT_PIPELINE, "d1",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}", "doc:main", "{\"docRef\":{\"id\":\"d1\"}}", now);
        when(taskRepository.findById(4L, "p1")).thenReturn(Optional.of(current));
        when(taskRepository.save(any(Task.class))).thenAnswer(invocation -> invocation.getArgument(0));

        service.updateTaskStatus(4L, "p1", TaskStatus.FAILED, null, "处理失败", "status_change");

        ArgumentCaptor<Task> taskCaptor = ArgumentCaptor.forClass(Task.class);
        verify(taskRepository).save(taskCaptor.capture());
        assertEquals("处理失败", String.valueOf(readViewData(taskCaptor.getValue()).get("failedReason")));
    }

    private Task visibleTask(Long taskRecordId, String publicTaskId, String projectId, String kbId, Long userId,
                             String type, String typeId, TaskStatus status, String pipelineContext,
                             String currentStage, String viewData, Instant now) {
        return new Task(taskRecordId, publicTaskId, projectId, kbId, userId, type, status,
                currentStage, pipelineContext, viewData, typeId, now, now);
    }

    private StageExecution stageExecution(Long id, Long taskId, String stageKey, String executorType,
                                          String executionType, TaskStatus status, String inputJson,
                                          String outputJson, String errorJson, Instant now) {
        return new StageExecution(id, taskId, stageKey, executorType, executionType, status,
                inputJson, outputJson, errorJson, 1, now, null, now, now);
    }

    private Map<String, Object> readViewData(Task task) {
        try {
            return new ObjectMapper().readValue(task.getViewData(),
                    new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
