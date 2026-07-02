// Responsibility: Compensate task.status DLQ incidents by forcing stage and parent task to FAILED.
package com.notebook.learyAI.module.task.application.status;

import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.infrastructure.mq.TaskStatusEvent;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class TaskStatusDlqCompensationAppService {
    private static final String CHANGE_TYPE = "dlq_status_compensate";
    private static final String ERROR_CODE = "TASK_STATUS_DLQ";

    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final TaskWorkflowOrchestrator taskWorkflowOrchestrator;

    public TaskStatusDlqCompensationAppService(TaskAppService taskAppService,
                                               TaskStatusService taskStatusService,
                                               TaskWorkflowOrchestrator taskWorkflowOrchestrator) {
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.taskWorkflowOrchestrator = taskWorkflowOrchestrator;
    }

    @Transactional
    public boolean compensate(TaskStatusEvent event, String errorMessage) {
        if (event == null || event.getTaskRecordId() == null || event.getTaskRecordId() <= 0L) {
            throw new BizException("KB-400", "taskRecordId required");
        }
        StageExecution currentStage = taskAppService.findStageExecutionById(event.getTaskRecordId())
                .orElseThrow(() -> new BizException("KB-404", "stageExecution not found"));
        Task parentTask = taskAppService.findById(currentStage.getTaskId())
                .orElseThrow(() -> new BizException("KB-404", "task not found"));
        String message = normalizeErrorMessage(errorMessage);
        TaskStatusService.StageStatusApplyResult applyResult = taskStatusService.applyStageStatus(
                currentStage.getId(),
                TaskStatus.FAILED,
                null,
                message,
                ERROR_CODE,
                message,
                CHANGE_TYPE
        ).orElse(null);
        if (applyResult == null) {
            return false;
        }
        taskWorkflowOrchestrator.onStageStatusChanged(
                applyResult.stageExecution(),
                parentTask.getProjectId(),
                TaskStatus.FAILED,
                null,
                message,
                parentTask.getKbId(),
                event.getUserId(),
                CHANGE_TYPE
        );
        return true;
    }

    private String normalizeErrorMessage(String errorMessage) {
        if (errorMessage == null || errorMessage.isBlank()) {
            return "task status event entered DLQ after retries exhausted";
        }
        return errorMessage.trim();
    }
}
