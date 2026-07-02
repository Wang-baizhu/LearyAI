// Responsibility: Validate and consume task.event.status.changed events with idempotency and orchestration.
package com.notebook.learyAI.module.task.application.status;

import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.orchestration.TaskStageStatusHandlerRegistry;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class TaskStatusMqConsumerAppService {
    private final TaskStatusService taskStatusService;
    private final TaskStatusEventIdempotencyRepository idempotencyRepository;
    private final TaskAppService taskAppService;
    private final TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    private final TaskStageStatusHandlerRegistry stageStatusHandlerRegistry;

    public TaskStatusMqConsumerAppService(TaskStatusService taskStatusService,
                                          TaskStatusEventIdempotencyRepository idempotencyRepository,
                                          TaskAppService taskAppService,
                                          TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                          TaskStageStatusHandlerRegistry stageStatusHandlerRegistry) {
        this.taskStatusService = taskStatusService;
        this.idempotencyRepository = idempotencyRepository;
        this.taskAppService = taskAppService;
        this.taskWorkflowOrchestrator = taskWorkflowOrchestrator;
        this.stageStatusHandlerRegistry = stageStatusHandlerRegistry;
    }

    @Transactional
    public TaskStatusConsumeResult consume(String messageId,
                                           String projectId,
                                           String kbId,
                                           Long taskRecordId,
                                           String taskTypeRaw,
                                           String statusRaw,
                                           String changeTypeRaw,
                                           Map<String, Object> result,
                                           String infoRaw,
                                           String errorCodeRaw,
                                           String errorMessageRaw,
                                           String stageRunKeyRaw,
                                           Long userId) {
        String normalizedMessageId = requiredText(messageId, "messageId required");
        Long normalizedStageExecutionId = normalizeTaskRecordId(taskRecordId);
        String taskType = normalizeTaskType(taskTypeRaw);
        TaskStatus status = parseStatus(statusRaw);
        String changeType = normalizeChangeType(changeTypeRaw);
        String info = normalizeText(infoRaw);
        String stageRunKey = normalizeText(stageRunKeyRaw);
        String errorCode = normalizeText(errorCodeRaw);
        String errorMessage = normalizeText(errorMessageRaw);

        StageExecution stageExecution = taskAppService.findStageExecutionById(normalizedStageExecutionId)
                .orElseThrow(() -> new BizException("KB-404", "stageExecution not found"));
        String normalizedProjectId = normalizeProjectId(projectId, stageExecution, taskType);
        String normalizedKbId = normalizeKbId(kbId, stageExecution, taskType);
        Task parentTask = taskAppService.findById(stageExecution.getTaskId(), normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "task not found"));
        if (!taskType.equals(stageExecution.getExecutorType())) {
            throw new BizException("KB-400", "taskType mismatch");
        }
        if (!sameScopeValue(parentTask.getProjectId(), normalizedProjectId)) {
            throw new BizException("KB-400", "projectId mismatch");
        }
        if (!sameScopeValue(parentTask.getKbId(), normalizedKbId)) {
            throw new BizException("KB-400", "kbId mismatch");
        }
        if (stageExecution.getStageKey() != null && stageRunKey != null && !stageExecution.getStageKey().equals(stageRunKey)) {
            throw new BizException("KB-400", "stageRunKey mismatch");
        }
        boolean firstSeen = idempotencyRepository.markProcessed(normalizedMessageId, normalizedProjectId,
                normalizedStageExecutionId, status, Instant.now());
        if (!firstSeen) {
            return TaskStatusConsumeResult.DUPLICATE;
        }
        routeStatusEvent(parentTask, stageExecution, status, result, info, errorCode, errorMessage, changeType, normalizedKbId, userId);
        return TaskStatusConsumeResult.PROCESSED;
    }

    private String requiredText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", message);
        }
        return value.trim();
    }

    private Long normalizeTaskRecordId(Long taskRecordId) {
        if (taskRecordId == null || taskRecordId <= 0L) {
            throw new BizException("KB-400", "taskRecordId required");
        }
        return taskRecordId;
    }

    private String normalizeProjectId(String projectId, StageExecution stageExecution, String taskType) {
        String value = normalizeText(projectId);
        if (value == null) {
            if (allowsEmptyScope(stageExecution, taskType)) {
                return null;
            }
            throw new BizException("KB-400", "projectId required");
        }
        try {
            return UUID.fromString(value).toString();
        } catch (IllegalArgumentException ex) {
            throw new BizException("KB-400", "projectId invalid");
        }
    }

    private String normalizeKbId(String kbId, StageExecution stageExecution, String taskType) {
        String value = normalizeText(kbId);
        if (value == null && !allowsEmptyScope(stageExecution, taskType)) {
            throw new BizException("KB-400", "kbId required");
        }
        return value;
    }

    private TaskStatus parseStatus(String status) {
        String value = requiredText(status, "status required");
        try {
            return TaskStatus.valueOf(value.toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BizException("KB-400", "status invalid");
        }
    }

    private String normalizeTaskType(String taskTypeRaw) {
        String value = requiredText(taskTypeRaw, "taskType required");
        if (!stageStatusHandlerRegistry.isRegistered(value)) {
            throw new BizException("KB-400", "taskType invalid");
        }
        return value;
    }

    private String normalizeChangeType(String changeType) {
        if (changeType == null || changeType.isBlank()) {
            return "status_change";
        }
        return changeType.trim();
    }

    private String normalizeText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private boolean allowsEmptyScope(StageExecution stageExecution, String taskType) {
        if (stageExecution == null) {
            return false;
        }
        return stageStatusHandlerRegistry.require(taskType).allowsEmptyScope(stageExecution);
    }

    private boolean sameScopeValue(String expected, String actual) {
        String normalizedExpected = normalizeText(expected);
        String normalizedActual = normalizeText(actual);
        if (normalizedExpected == null || normalizedActual == null) {
            return normalizedExpected == null && normalizedActual == null;
        }
        return normalizedExpected.equals(normalizedActual);
    }

    private void routeStatusEvent(Task parentTask,
                                  StageExecution stageExecution,
                                  TaskStatus status,
                                  Map<String, Object> result,
                                  String info,
                                  String errorCode,
                                  String errorMessage,
                                  String changeType,
                                  String kbId,
                                  Long userId) {
        TaskStatusService.StageStatusApplyResult applyResult = taskStatusService.applyStageStatus(
                stageExecution.getId(), status, result, info, errorCode, errorMessage, changeType
        ).orElse(null);
        if (applyResult == null) {
            return;
        }
        taskWorkflowOrchestrator.onStageStatusChanged(
                applyResult.stageExecution(),
                parentTask.getProjectId(),
                status,
                result,
                info,
                kbId,
                userId,
                changeType
        );
    }
}
