// Responsibility: Verify task status consumer validation, idempotency and orchestrator delegation.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.orchestration.TaskStageStatusHandler;
import com.notebook.learyAI.module.task.application.orchestration.TaskStageStatusHandlerRegistry;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.status.TaskStatusConsumeResult;
import com.notebook.learyAI.module.task.application.status.TaskStatusEventIdempotencyRepository;
import com.notebook.learyAI.module.task.application.status.TaskStatusMqConsumerAppService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskStatusMqConsumerAppServiceTest {
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private TaskStatusEventIdempotencyRepository idempotencyRepository;
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskWorkflowOrchestrator taskWorkflowOrchestrator;

    @Test
    @DisplayName("consume: doc PROCESSING 事件应更新阶段任务并委托 orchestrator")
    void consume_whenDocProcessing_shouldUpdateStageAndDelegate() {
        TaskStatusMqConsumerAppService appService = newAppService();
        String projectId = "b25b3db6-3a3a-46ac-8117-06dc938acaed";
        StageExecution stageTask = stageTask(9L, 1L, "doc:main", TaskTypes.DOC, "doc-1",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        Task parentTask = visibleTask(1L, "task-1", projectId, "kb-1", 12L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        when(idempotencyRepository.markProcessed(eq("evt_001"), eq(projectId), eq(9L),
                eq(TaskStatus.PROCESSING), any())).thenReturn(true);
        when(taskAppService.findStageExecutionById(9L)).thenReturn(Optional.of(stageTask));
        when(taskAppService.findById(1L, projectId)).thenReturn(Optional.of(parentTask));
        when(taskStatusService.applyStageStatus(9L, TaskStatus.PROCESSING, null, "running", null, null, "status_change"))
                .thenReturn(Optional.of(new TaskStatusService.StageStatusApplyResult(stageTask)));

        TaskStatusConsumeResult result = appService.consume(
                "evt_001", projectId, "kb-1", 9L, "doc", "processing",
                null, null, "  running ", null, null, "doc:main", 12L
        );

        assertEquals(TaskStatusConsumeResult.PROCESSED, result);
        verify(taskStatusService).applyStageStatus(
                9L, TaskStatus.PROCESSING, null, "running", null, null, "status_change"
        );
        verify(taskWorkflowOrchestrator).onStageStatusChanged(stageTask, projectId, TaskStatus.PROCESSING,
                null, "running", "kb-1", 12L, "status_change");
    }

    @Test
    @DisplayName("consume: 重复事件应返回 DUPLICATE 且不触发后续处理")
    void consume_whenDuplicate_shouldSkipAllActions() {
        TaskStatusMqConsumerAppService appService = newAppService();
        String projectId = "b25b3db6-3a3a-46ac-8117-06dc938acaed";
        StageExecution stageTask = stageTask(11L, 1L, "doc:main", TaskTypes.DOC, "doc-1",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        Task parentTask = visibleTask(1L, "task-1", projectId, "kb-1", 12L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        when(taskAppService.findStageExecutionById(11L)).thenReturn(Optional.of(stageTask));
        when(taskAppService.findById(1L, projectId)).thenReturn(Optional.of(parentTask));
        when(idempotencyRepository.markProcessed(eq("evt_dup"), eq(projectId), eq(11L),
                eq(TaskStatus.PROCESSING), any())).thenReturn(false);

        TaskStatusConsumeResult result = appService.consume(
                "evt_dup", projectId, "kb-1", 11L, "doc", "PROCESSING",
                "status_change", null, null, null, null, "doc:main", 1L
        );

        assertEquals(TaskStatusConsumeResult.DUPLICATE, result);
        verify(taskStatusService, never()).applyStageStatus(any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("consume: 状态未被接受时不应继续驱动 orchestrator")
    void consume_whenStatusRejected_shouldSkipOrchestrator() {
        TaskStatusMqConsumerAppService appService = newAppService();
        String projectId = "b25b3db6-3a3a-46ac-8117-06dc938acaed";
        StageExecution stageTask = stageTask(10L, 1L, "doc:main", TaskTypes.DOC, "doc-1",
                TaskStatus.DONE, "{\"kbId\":\"kb-1\"}");
        Task parentTask = visibleTask(1L, "task-1", projectId, "kb-1", 12L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        when(idempotencyRepository.markProcessed(eq("evt_replay"), eq(projectId), eq(10L),
                eq(TaskStatus.FAILED), any())).thenReturn(true);
        when(taskAppService.findStageExecutionById(10L)).thenReturn(Optional.of(stageTask));
        when(taskAppService.findById(1L, projectId)).thenReturn(Optional.of(parentTask));
        when(taskStatusService.applyStageStatus(10L, TaskStatus.FAILED, null, null, null, null, "status_change"))
                .thenReturn(Optional.empty());

        TaskStatusConsumeResult result = appService.consume(
                "evt_replay", projectId, "kb-1", 10L, "doc", "FAILED",
                null, null, null, null, null, "doc:main", 12L
        );

        assertEquals(TaskStatusConsumeResult.PROCESSED, result);
        verify(taskWorkflowOrchestrator, never()).onStageStatusChanged(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("consume: projectId 非法应抛出 KB-400")
    void consume_whenProjectIdInvalid_shouldThrowKb400() {
        TaskStatusMqConsumerAppService appService = newAppService();
        StageExecution stageTask = stageTask(1L, 1L, "doc:main", TaskTypes.DOC, "doc-1",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        when(taskAppService.findStageExecutionById(1L)).thenReturn(Optional.of(stageTask));
        BizException ex = assertThrows(BizException.class, () -> appService.consume(
                "evt_invalid", "bad-project", "kb-1", 1L, "doc", "PROCESSING",
                null, null, null, null, null, "doc:main", 1L
        ));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("consume: kbId 不匹配应抛出 KB-400")
    void consume_whenKbIdMismatch_shouldThrowKb400() {
        TaskStatusMqConsumerAppService appService = newAppService();
        String projectId = "b25b3db6-3a3a-46ac-8117-06dc938acaed";
        StageExecution stageTask = stageTask(9L, 1L, "doc:main", TaskTypes.DOC, "doc-1",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-2\"}");
        Task parentTask = visibleTask(1L, "task-1", projectId, "kb-2", 12L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-2\"}");
        when(taskAppService.findStageExecutionById(9L)).thenReturn(Optional.of(stageTask));
        when(taskAppService.findById(1L, projectId)).thenReturn(Optional.of(parentTask));

        BizException ex = assertThrows(BizException.class, () -> appService.consume(
                "evt_002", projectId, "kb-1", 9L, "doc", "PROCESSING",
                null, null, null, null, null, "doc:main", 12L
        ));
        assertEquals("KB-400", ex.getCode());
        verify(idempotencyRepository, never()).markProcessed(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("consume: task 不存在时不应写入幂等记录")
    void consume_whenTaskMissing_shouldNotMarkIdempotency() {
        TaskStatusMqConsumerAppService appService = newAppService();
        String projectId = "b25b3db6-3a3a-46ac-8117-06dc938acaed";
        when(taskAppService.findStageExecutionById(19L)).thenReturn(Optional.empty());

        BizException ex = assertThrows(BizException.class, () -> appService.consume(
                "evt_missing", projectId, "kb-1", 19L, "doc", "PROCESSING",
                null, null, null, null, null, "doc:main", 12L
        ));

        assertEquals("KB-404", ex.getCode());
        verify(idempotencyRepository, never()).markProcessed(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("consume: stageRunKey 不匹配时不应写入幂等记录")
    void consume_whenStageRunKeyMismatch_shouldNotMarkIdempotency() {
        TaskStatusMqConsumerAppService appService = newAppService();
        String projectId = "b25b3db6-3a3a-46ac-8117-06dc938acaed";
        StageExecution stageTask = stageTask(21L, 1L, "doc:main", TaskTypes.DOC, "doc-1",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        Task parentTask = visibleTask(1L, "task-1", projectId, "kb-1", 12L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}");
        when(taskAppService.findStageExecutionById(21L)).thenReturn(Optional.of(stageTask));
        when(taskAppService.findById(1L, projectId)).thenReturn(Optional.of(parentTask));

        BizException ex = assertThrows(BizException.class, () -> appService.consume(
                "evt_bad_stage", projectId, "kb-1", 21L, "doc", "PROCESSING",
                null, null, null, null, null, "agent:summary", 12L
        ));

        assertEquals("KB-400", ex.getCode());
        verify(idempotencyRepository, never()).markProcessed(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("consume: pptprompt 阶段应允许空 projectId 和 kbId")
    void consume_whenPptPromptPipeline_shouldAllowNullScope() {
        TaskStatusMqConsumerAppService appService = newAppService();
        StageExecution stageTask = stageTask(31L, 3L, TaskWorkflowDefinitions.AGENT_PPTPROMPT_STAGE_RUN_KEY,
                TaskTypes.AGENT, TaskWorkflowDefinitions.AGENT_TASK_TYPE_PPTPROMPT,
                TaskStatus.PROCESSING, "{\"agentTaskType\":\"pptprompt\"}");
        Task parentTask = visibleTask(3L, "task-3", null, null, 12L, TaskTypes.PPTPROMPT_PIPELINE,
                "_", TaskStatus.PROCESSING, "{\"promptMarkdown\":\"body_1\"}");
        when(taskAppService.findStageExecutionById(31L)).thenReturn(Optional.of(stageTask));
        when(taskAppService.findById(3L, null)).thenReturn(Optional.of(parentTask));
        when(idempotencyRepository.markProcessed(eq("evt_ppt"), eq(null), eq(31L),
                eq(TaskStatus.DONE), any())).thenReturn(true);
        when(taskStatusService.applyStageStatus(31L, TaskStatus.DONE, Map.of("outputText", "ok"), null, null, null, "status_change"))
                .thenReturn(Optional.of(new TaskStatusService.StageStatusApplyResult(stageTask)));

        TaskStatusConsumeResult result = appService.consume(
                "evt_ppt", null, null, 31L, "agent", "DONE",
                null, Map.of("outputText", "ok"), null, null, null,
                TaskWorkflowDefinitions.AGENT_PPTPROMPT_STAGE_RUN_KEY, 12L
        );

        assertEquals(TaskStatusConsumeResult.PROCESSED, result);
        verify(taskWorkflowOrchestrator).onStageStatusChanged(stageTask, null, TaskStatus.DONE,
                Map.of("outputText", "ok"), null, null, 12L, "status_change");
    }

    private TaskStatusMqConsumerAppService newAppService() {
        return new TaskStatusMqConsumerAppService(
                taskStatusService,
                idempotencyRepository,
                taskAppService,
                taskWorkflowOrchestrator,
                new TaskStageStatusHandlerRegistry(java.util.List.of(
                        handler(TaskTypes.DOC, false),
                        handler(TaskTypes.AGENT, true),
                        handler(TaskTypes.TEMPLATE_PLUGIN_PUBLISH, false)
                ))
        );
    }

    private TaskStageStatusHandler handler(String executorType, boolean allowEmptyScope) {
        return new TaskStageStatusHandler() {
            @Override
            public String executorType() {
                return executorType;
            }

            @Override
            public boolean allowsEmptyScope(StageExecution stageExecution) {
                return allowEmptyScope
                        && stageExecution != null
                        && TaskWorkflowDefinitions.AGENT_PPTPROMPT_STAGE_RUN_KEY.equals(stageExecution.getStageKey());
            }

            @Override
            public void onStageStatusChanged(com.notebook.learyAI.module.task.application.orchestration.TaskStageStatusContext context) {
            }
        };
    }

    private Task visibleTask(Long taskRecordId, String publicTaskId, String projectId, String kbId, Long userId,
                             String type, String typeId, TaskStatus status, String pipelineContext) {
        Instant now = Instant.now();
        return new Task(taskRecordId, publicTaskId, projectId, kbId, userId, type, status,
                null, pipelineContext, null, typeId, now, now);
    }

    private StageExecution stageTask(Long taskRecordId, Long parentTaskRecordId, String stageRunKey,
                                     String type, String typeId, TaskStatus status, String stagePayload) {
        Instant now = Instant.now();
        return new StageExecution(taskRecordId, parentTaskRecordId, stageRunKey, type, typeId,
                status, stagePayload, null, null, 1, now, null, now, now);
    }
}
