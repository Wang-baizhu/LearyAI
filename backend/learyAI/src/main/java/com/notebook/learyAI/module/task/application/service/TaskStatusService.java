// Responsibility: Update task status and broadcast SSE events when status changes.
package com.notebook.learyAI.module.task.application.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.push.TenantPushRegistry;
import com.notebook.learyAI.module.task.application.push.dto.TaskPushEvent;
import com.notebook.learyAI.module.task.application.status.TaskStatusListener;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.domain.repository.StageExecutionRepository;
import com.notebook.learyAI.module.task.domain.repository.TaskRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Service
public class TaskStatusService {
    private final TaskRepository taskRepository;
    private final StageExecutionRepository stageExecutionRepository;
    private final TenantPushRegistry pushRegistry;
    private final List<TaskStatusListener> statusListeners;
    private final ObjectMapper objectMapper;

    @Autowired
    public TaskStatusService(TaskRepository taskRepository,
                             StageExecutionRepository stageExecutionRepository,
                             TenantPushRegistry pushRegistry,
                             List<TaskStatusListener> statusListeners,
                             ObjectMapper objectMapper) {
        this.taskRepository = taskRepository;
        this.stageExecutionRepository = stageExecutionRepository;
        this.pushRegistry = pushRegistry;
        this.statusListeners = statusListeners == null ? List.of() : statusListeners;
        this.objectMapper = objectMapper;
    }

    public TaskStatusService(TaskRepository taskRepository,
                             TenantPushRegistry pushRegistry,
                             List<TaskStatusListener> statusListeners,
                             ObjectMapper objectMapper) {
        this(taskRepository, null, pushRegistry, statusListeners, objectMapper);
    }

    @Transactional
    public Optional<TaskPushEvent> updateStatus(Long taskRecordId, String projectId, TaskStatus newStatus,
                                                String pipelineContext, String changeType) {
        if (taskRecordId == null) {
            throw new BizException("KB-400", "taskRecordId required");
        }
        if (newStatus == null) {
            throw new BizException("KB-400", "status required");
        }
        Task current = findTask(taskRecordId, projectId)
                .orElseThrow(() -> new BizException("KB-404", "task not found"));
        return updateStatusInternal(current, newStatus, pipelineContext, changeType)
                .flatMap(UpdateStatusResult::event);
    }

    @Transactional
    public Optional<TaskPushEvent> updateTaskStatus(Long taskRecordId, String projectId, TaskStatus newStatus,
                                                    Map<String, Object> metadataUpdates, String info,
                                                    String changeType) {
        return applyTaskStatus(taskRecordId, projectId, newStatus, metadataUpdates, info, changeType)
                .flatMap(TaskStatusApplyResult::event);
    }

    @Transactional
    public Optional<TaskStatusApplyResult> applyTaskStatus(Long taskRecordId, String projectId, TaskStatus newStatus,
                                                           Map<String, Object> metadataUpdates, String info,
                                                           String changeType) {
        if (taskRecordId == null) {
            throw new BizException("KB-400", "taskRecordId required");
        }
        if (newStatus == null) {
            throw new BizException("KB-400", "status required");
        }
        Task current = findTask(taskRecordId, projectId)
                .orElseThrow(() -> new BizException("KB-404", "task not found"));
        Task next = buildNextTask(current, newStatus, metadataUpdates, info);
        return updateStatusInternal(current, next, changeType)
                .map(result -> new TaskStatusApplyResult(result.task(), result.event()));
    }

    public void publishSnapshot(Task task, String changeType) {
        if (task == null) {
            throw new BizException("KB-400", "task required");
        }
        TaskPushEvent event = buildSnapshotEvent(task, changeType);
        dispatchAfterCommit(event, task.getUserId());
    }

    @Transactional
    public Optional<StageStatusApplyResult> applyStageStatus(Long stageExecutionId,
                                                             TaskStatus newStatus,
                                                             Map<String, Object> output,
                                                             String info,
                                                             String errorCode,
                                                             String errorMessage,
                                                             String changeType) {
        if (stageExecutionId == null || stageExecutionId <= 0L) {
            throw new BizException("KB-400", "stageExecutionId required");
        }
        if (newStatus == null) {
            throw new BizException("KB-400", "status required");
        }
        StageExecution current = stageExecutionRepository.findById(stageExecutionId)
                .orElseThrow(() -> new BizException("KB-404", "stageExecution not found"));
        StageExecution next = buildNextStage(current, newStatus, output, info, errorCode, errorMessage, changeType);
        if (!isAllowedTransition(current.getStatus(), next.getStatus(), changeType)) {
            return Optional.empty();
        }
        if (sameStageState(current, next)) {
            return Optional.empty();
        }
        return Optional.of(new StageStatusApplyResult(stageExecutionRepository.save(next)));
    }

    @Transactional
    public Optional<StageStatusApplyResult> retryStageExecution(Task parentTask,
                                                                StageExecution stageExecution,
                                                                String changeType) {
        if (stageExecution == null || stageExecution.getId() == null || stageExecution.getId() <= 0L) {
            throw new BizException("KB-400", "stageExecution required");
        }
        String normalizedChangeType = normalizeText(changeType);
        if (normalizedChangeType == null || !normalizedChangeType.startsWith("retry")) {
            throw new BizException("KB-400", "retry changeType required");
        }
        StageExecution current = stageExecutionRepository.findById(stageExecution.getId())
                .orElseThrow(() -> new BizException("KB-404", "stageExecution not found"));
        StageExecution next = buildNextStage(current, TaskStatus.PROCESSING, null, null, null, null, normalizedChangeType);
        if (!isAllowedTransition(current.getStatus(), next.getStatus(), normalizedChangeType)) {
            return Optional.empty();
        }
        if (sameStageState(current, next)) {
            return Optional.empty();
        }
        StageExecution saved = stageExecutionRepository.save(next);
        return Optional.of(new StageStatusApplyResult(saved));
    }

    private Optional<UpdateStatusResult> updateStatusInternal(Task current, TaskStatus newStatus, String pipelineContext,
                                                              String changeType) {
        String viewData = current.getViewData();
        Map<String, Object> parsed = readJsonMap(pipelineContext);
        if (parsed.containsKey("info")) {
            Map<String, Object> nextViewData = new HashMap<>();
            nextViewData.put("info", parsed.get("info"));
            viewData = writeJson(nextViewData);
        }
        Task next = current.withState(newStatus, pipelineContext, current.getCurrentStage(), viewData, Instant.now());
        return updateStatusInternal(current, next, changeType);
    }

    private Optional<UpdateStatusResult> updateStatusInternal(Task current, Task next, String changeType) {
        if (!isAllowedTransition(current.getStatus(), next.getStatus(), changeType)) {
            return Optional.empty();
        }
        if (sameTaskState(current, next)) {
            return Optional.empty();
        }
        Task saved = taskRepository.save(next);
        notifyListeners(saved, current.getStatus(), changeType);
        TaskPushEvent event = buildEvent(saved, changeType);
        dispatchAfterCommit(event, saved.getUserId());
        return Optional.of(new UpdateStatusResult(saved, Optional.of(event)));
    }

    private Optional<Task> findTask(Long taskRecordId, String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return taskRepository.findById(taskRecordId);
        }
        return taskRepository.findById(taskRecordId, projectId);
    }

    private boolean isAllowedTransition(TaskStatus current, TaskStatus next, String changeType) {
        if (current == null || next == null) {
            return true;
        }
        boolean retry = changeType != null && changeType.trim().startsWith("retry");
        if ((current == TaskStatus.DONE || current == TaskStatus.FAILED) && !retry) {
            return next == current;
        }
        if (current == TaskStatus.PROCESSING && (next == TaskStatus.UPLOADING || next == TaskStatus.UPLOADED)) {
            return false;
        }
        if (current == TaskStatus.UPLOADED && next == TaskStatus.UPLOADING) {
            return false;
        }
        return true;
    }

    private boolean sameTaskState(Task current, Task next) {
        return next.getStatus() == current.getStatus()
                && Objects.equals(next.getPipelineContext(), current.getPipelineContext())
                && Objects.equals(next.getCurrentStage(), current.getCurrentStage())
                && Objects.equals(next.getViewData(), current.getViewData());
    }

    private String mergeJson(String existing, Map<String, Object> updates, String info) {
        boolean hasUpdates = updates != null && !updates.isEmpty();
        boolean hasInfo = info != null && !info.isBlank();
        if (!hasUpdates && !hasInfo) {
            return existing;
        }
        Map<String, Object> payload = readJsonMap(existing);
        if (hasUpdates) {
            payload.putAll(updates);
        }
        if (hasInfo) {
            payload.put("info", info.trim());
        }
        return writeJson(payload);
    }

    private Task buildNextTask(Task current, TaskStatus newStatus, Map<String, Object> updates, String info) {
        Instant now = Instant.now();
        String pipelineContext = current.getPipelineContext();
        String currentStage = current.getCurrentStage();
        String viewData = current.getViewData();
        currentStage = resolveNextCurrentStage(currentStage, updates);
        viewData = mergeViewJson(viewData, withoutStage(updates), info, newStatus);
        return current.withState(newStatus, pipelineContext, currentStage, viewData, now);
    }

    private StageExecution buildNextStage(StageExecution current,
                                          TaskStatus newStatus,
                                          Map<String, Object> output,
                                          String info,
                                          String errorCode,
                                          String errorMessage,
                                          String changeType) {
        Instant now = Instant.now();
        Integer attemptNo = current.getAttemptNo() == null || current.getAttemptNo() <= 0 ? 1 : current.getAttemptNo();
        Instant startedAt = current.getStartedAt();
        Instant finishedAt = current.getFinishedAt();
        String outputJson = current.getOutputJson();
        String errorJson = current.getErrorJson();

        boolean retryTransition = changeType != null && changeType.trim().startsWith("retry") && newStatus == TaskStatus.PROCESSING;
        if (retryTransition) {
            attemptNo = attemptNo + 1;
            startedAt = now;
            finishedAt = null;
            outputJson = null;
            errorJson = null;
        } else if (newStatus == TaskStatus.PROCESSING && startedAt == null) {
            startedAt = now;
            finishedAt = null;
        } else if (newStatus == TaskStatus.DONE || newStatus == TaskStatus.FAILED) {
            finishedAt = now;
        }

        if (output != null && !output.isEmpty()) {
            outputJson = writeJson(output);
        }
        if (newStatus == TaskStatus.FAILED) {
            errorJson = buildErrorJson(errorCode, errorMessage, info);
        } else if (!retryTransition) {
            errorJson = null;
        }
        return current.withState(newStatus, current.getInputJson(), outputJson, errorJson, attemptNo, startedAt, finishedAt, now);
    }

    private boolean sameStageState(StageExecution current, StageExecution next) {
        return current.getStatus() == next.getStatus()
                && Objects.equals(current.getOutputJson(), next.getOutputJson())
                && Objects.equals(current.getErrorJson(), next.getErrorJson())
                && Objects.equals(current.getAttemptNo(), next.getAttemptNo())
                && Objects.equals(current.getStartedAt(), next.getStartedAt())
                && Objects.equals(current.getFinishedAt(), next.getFinishedAt());
    }

    private Map<String, Object> readJsonMap(String raw) {
        if (raw == null || raw.isBlank()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(raw, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {});
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new BizException("KB-500", "json parse failed");
        }
    }

    private String writeJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw new BizException("KB-500", "json serialize failed");
        }
    }

    private void notifyListeners(Task task, TaskStatus prevStatus, String changeType) {
        if (statusListeners.isEmpty()) {
            return;
        }
        for (TaskStatusListener listener : statusListeners) {
            listener.onStatusChanged(task, prevStatus, changeType);
        }
    }

    private TaskPushEvent buildEvent(Task task, String changeType) {
        Instant updatedAt = task.getUpdatedAt();
        Long revision = updatedAt == null ? null : updatedAt.toEpochMilli();
        String status = task.getStatus() == null ? null : task.getStatus().name();
        Map<String, Object> viewData = readJsonMap(task.getViewData());
        String publicTaskId = requirePublicTaskId(task);
        return new TaskPushEvent(publicTaskId, String.valueOf(task.getProjectId()), task.getKbId(), task.getType(),
                status, updatedAt, revision, changeType, normalizeCurrentStage(task.getCurrentStage()), viewData);
    }

    private TaskPushEvent buildSnapshotEvent(Task task, String changeType) {
        Instant updatedAt = task.getUpdatedAt();
        Long revision = updatedAt == null ? null : updatedAt.toEpochMilli();
        String status = task.getStatus() == null ? null : task.getStatus().name();
        Map<String, Object> viewData = readJsonMap(task.getViewData());
        String publicTaskId = requirePublicTaskId(task);
        return new TaskPushEvent(publicTaskId, String.valueOf(task.getProjectId()), task.getKbId(), task.getType(),
                status, updatedAt, revision, changeType, normalizeCurrentStage(task.getCurrentStage()), viewData);
    }

    private String normalizeCurrentStage(String currentStage) {
        if (currentStage == null || currentStage.isBlank()) {
            return null;
        }
        return currentStage.trim();
    }

    private String normalizeText(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private String resolveNextCurrentStage(String existingCurrentStage, Map<String, Object> updates) {
        if (updates == null || updates.isEmpty()) {
            return existingCurrentStage;
        }
        Object rawStage = updates.get("stage");
        if (!(rawStage instanceof Map<?, ?> stageMap)) {
            return existingCurrentStage;
        }
        Object runKey = stageMap.get("runKey");
        if (runKey instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        return existingCurrentStage;
    }

    private Map<String, Object> withoutStage(Map<String, Object> updates) {
        if (updates == null || updates.isEmpty() || !updates.containsKey("stage")) {
            return updates;
        }
        Map<String, Object> sanitized = new HashMap<>(updates);
        sanitized.remove("stage");
        return sanitized;
    }

    private Map<String, Object> withoutErrorFields(Map<String, Object> updates) {
        if (updates == null || updates.isEmpty()) {
            return updates;
        }
        if (!updates.containsKey("errorCode") && !updates.containsKey("errorMessage")) {
            return updates;
        }
        Map<String, Object> sanitized = new HashMap<>(updates);
        sanitized.remove("errorCode");
        sanitized.remove("errorMessage");
        return sanitized;
    }

    private String mergeViewJson(String existing, Map<String, Object> updates, String info, TaskStatus newStatus) {
        Map<String, Object> payload = readJsonMap(existing);
        if (updates != null && !updates.isEmpty()) {
            payload.putAll(updates);
        }
        if (info != null && !info.isBlank()) {
            payload.put("info", info.trim());
        }
        if (newStatus == TaskStatus.FAILED) {
            String failedReason = normalizeFailureReason(updates, info);
            if (failedReason != null) {
                payload.put("failedReason", failedReason);
            }
        } else {
            payload.remove("failedReason");
        }
        return writeJson(payload);
    }

    private String normalizeFailureReason(Map<String, Object> updates, String info) {
        if (updates != null && updates.get("errorMessage") instanceof String message && !message.isBlank()) {
            return message.trim();
        }
        if (info != null && !info.isBlank()) {
            return info.trim();
        }
        return null;
    }

    private String buildErrorJson(String errorCode, String errorMessage, String info) {
        Map<String, Object> error = new HashMap<>();
        putText(error, "code", errorCode);
        putText(error, "message", errorMessage == null ? info : errorMessage);
        error.put("retryable", Boolean.FALSE);
        return writeJson(error);
    }

    private void putText(Map<String, Object> target, String key, String value) {
        if (target == null || key == null || key.isBlank() || value == null || value.isBlank()) {
            return;
        }
        target.put(key, value.trim());
    }

    private String requirePublicTaskId(Task task) {
        if (task == null || task.getPublicTaskId() == null || task.getPublicTaskId().isBlank()) {
            throw new BizException("KB-500", "publicTaskId required");
        }
        return task.getPublicTaskId().trim();
    }

    private void dispatchAfterCommit(TaskPushEvent event, Long userId) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TaskEventSynchronization(pushRegistry, event, userId));
        } else {
            pushRegistry.broadcast(event.getProjectId(), event.getKbId(), userId, event);
        }
    }

    private static final class TaskEventSynchronization implements TransactionSynchronization {
        private final TenantPushRegistry pushRegistry;
        private final TaskPushEvent event;
        private final Long userId;

        private TaskEventSynchronization(TenantPushRegistry pushRegistry, TaskPushEvent event, Long userId) {
            this.pushRegistry = pushRegistry;
            this.event = event;
            this.userId = userId;
        }

        @Override
        public int getOrder() {
            return Ordered.LOWEST_PRECEDENCE;
        }

        @Override
        public void afterCommit() {
            pushRegistry.broadcast(event.getProjectId(), event.getKbId(), userId, event);
        }
    }

    public record TaskStatusApplyResult(Task task, Optional<TaskPushEvent> event) {
    }

    public record StageStatusApplyResult(StageExecution stageExecution) {
    }

    private record UpdateStatusResult(Task task, Optional<TaskPushEvent> event) {
    }
}
