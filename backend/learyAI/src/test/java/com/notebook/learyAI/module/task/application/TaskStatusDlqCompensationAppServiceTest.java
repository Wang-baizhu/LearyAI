// Responsibility: Verify status DLQ compensation service forces FAILED stage projection idempotently.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.status.TaskStatusDlqCompensationAppService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.infrastructure.mq.TaskStatusEvent;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskStatusDlqCompensationAppServiceTest {
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private TaskWorkflowOrchestrator taskWorkflowOrchestrator;

    @Test
    @DisplayName("compensate: status DLQ 应把阶段强制置为 FAILED 并驱动父任务收敛")
    void compensate_whenApplied_shouldProjectFailed() {
        TaskStatusDlqCompensationAppService appService = new TaskStatusDlqCompensationAppService(
                taskAppService, taskStatusService, taskWorkflowOrchestrator
        );
        TaskStatusEvent event = new TaskStatusEvent();
        event.setTaskRecordId(11L);
        event.setUserId(99L);
        StageExecution stageExecution = stageExecution(11L, 1L, TaskStatus.PROCESSING);
        Task parentTask = task(1L, "project-1", "kb-1");
        when(taskAppService.findStageExecutionById(11L)).thenReturn(Optional.of(stageExecution));
        when(taskAppService.findById(1L)).thenReturn(Optional.of(parentTask));
        when(taskStatusService.applyStageStatus(
                11L, TaskStatus.FAILED, null,
                "task status event entered DLQ after retries exhausted",
                "TASK_STATUS_DLQ",
                "task status event entered DLQ after retries exhausted",
                "dlq_status_compensate"
        )).thenReturn(Optional.of(new TaskStatusService.StageStatusApplyResult(stageExecution)));

        boolean compensated = appService.compensate(event, null);

        assertTrue(compensated);
        verify(taskWorkflowOrchestrator).onStageStatusChanged(
                stageExecution,
                "project-1",
                TaskStatus.FAILED,
                null,
                "task status event entered DLQ after retries exhausted",
                "kb-1",
                99L,
                "dlq_status_compensate"
        );
    }

    @Test
    @DisplayName("compensate: 阶段状态未变化时不应重复驱动父任务收敛")
    void compensate_whenApplySkipped_shouldReturnFalse() {
        TaskStatusDlqCompensationAppService appService = new TaskStatusDlqCompensationAppService(
                taskAppService, taskStatusService, taskWorkflowOrchestrator
        );
        TaskStatusEvent event = new TaskStatusEvent();
        event.setTaskRecordId(12L);
        StageExecution stageExecution = stageExecution(12L, 2L, TaskStatus.FAILED);
        Task parentTask = task(2L, "project-2", "kb-2");
        when(taskAppService.findStageExecutionById(12L)).thenReturn(Optional.of(stageExecution));
        when(taskAppService.findById(2L)).thenReturn(Optional.of(parentTask));
        when(taskStatusService.applyStageStatus(
                eq(12L), eq(TaskStatus.FAILED), eq(null), eq("dlq err"),
                eq("TASK_STATUS_DLQ"), eq("dlq err"), eq("dlq_status_compensate")
        )).thenReturn(Optional.empty());

        boolean compensated = appService.compensate(event, "dlq err");

        assertFalse(compensated);
        verify(taskWorkflowOrchestrator, never()).onStageStatusChanged(
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any()
        );
    }

    private StageExecution stageExecution(Long id, Long taskId, TaskStatus status) {
        Instant now = Instant.now();
        return new StageExecution(id, taskId, "agent:summary", "agent", "kbsummary",
                status, "{}", null, null, 1, now, null, now, now);
    }

    private Task task(Long id, String projectId, String kbId) {
        Instant now = Instant.now();
        return new Task(id, "task-" + id, projectId, kbId, 1L, "document_pipeline", TaskStatus.PROCESSING,
                "agent:summary", "{}", "{}", "doc-1", now, now);
    }
}
