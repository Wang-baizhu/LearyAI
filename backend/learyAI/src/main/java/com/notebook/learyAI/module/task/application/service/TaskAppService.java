// Responsibility: Provide task operations for other modules.
package com.notebook.learyAI.module.task.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistries;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistry;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.domain.repository.StageExecutionRepository;
import com.notebook.learyAI.module.task.domain.repository.TaskRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Instant;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class TaskAppService {
    private final TaskPipelineRegistry taskPipelineRegistry;
    private final TaskRepository taskRepository;
    private final StageExecutionRepository stageExecutionRepository;
    private final TaskMqPublisher taskMqPublisher;
    private final ObjectMapper objectMapper;

    @Autowired
    public TaskAppService(TaskPipelineRegistry taskPipelineRegistry,
                          TaskRepository taskRepository,
                          StageExecutionRepository stageExecutionRepository,
                          TaskMqPublisher taskMqPublisher,
                          ObjectMapper objectMapper) {
        this.taskPipelineRegistry = taskPipelineRegistry;
        this.taskRepository = taskRepository;
        this.stageExecutionRepository = stageExecutionRepository;
        this.taskMqPublisher = taskMqPublisher;
        this.objectMapper = objectMapper;
    }

    public TaskAppService(TaskRepository taskRepository,
                          StageExecutionRepository stageExecutionRepository,
                          TaskMqPublisher taskMqPublisher,
                          ObjectMapper objectMapper) {
        this(TaskPipelineRegistries.defaultRegistry(), taskRepository, stageExecutionRepository, taskMqPublisher, objectMapper);
    }

    public TaskAppService(TaskRepository taskRepository,
                          TaskMqPublisher taskMqPublisher,
                          ObjectMapper objectMapper) {
        this(TaskPipelineRegistries.defaultRegistry(), taskRepository, null, taskMqPublisher, objectMapper);
    }

    public Task createVisibleTask(String projectId,
                                  String kbId,
                                  Long userId,
                                  String type,
                                  String typeId,
                                  TaskStatus status,
                                  String pipelineContext,
                                  Instant now) {
        Instant createdAt = now == null ? Instant.now() : now;
        String normalizedType = normalizeRequired(type, "type required");
        String normalizedProjectId = TaskTypes.PPTPROMPT_PIPELINE.equals(normalizedType)
                ? normalizeNullable(projectId)
                : normalizeRequired(projectId, "projectId required");
        String normalizedKbId = TaskTypes.PPTPROMPT_PIPELINE.equals(normalizedType)
                ? normalizeNullable(kbId)
                : normalizeRequired(kbId, "kbId required");
        Task task = Task.newVisibleTask(
                normalizedProjectId,
                normalizedKbId,
                userId,
                UUID.randomUUID().toString(),
                normalizedType,
                typeId,
                status,
                pipelineContext,
                initialCurrentStage(normalizedType, pipelineContext),
                extractInitialViewData(normalizedType, pipelineContext),
                createdAt
        );
        return taskRepository.save(task);
    }

    public StageExecution createStageExecution(Long taskId,
                                               String stageKey,
                                               String executorType,
                                               String executionType,
                                               TaskStatus status,
                                               String inputJson,
                                               Instant now) {
        Instant createdAt = now == null ? Instant.now() : now;
        StageExecution stageExecution = StageExecution.newExecution(
                taskId,
                normalizeRequired(stageKey, "stageKey required"),
                normalizeRequired(executorType, "executorType required"),
                normalizeRequired(executionType, "executionType required"),
                status,
                inputJson,
                createdAt
        );
        return stageExecutionRepository.save(stageExecution);
    }

    public StageExecution saveStageExecution(StageExecution stageExecution) {
        if (stageExecution == null) {
            throw new BizException("KB-400", "stageExecution required");
        }
        if (stageExecutionRepository == null) {
            throw new BizException("KB-500", "stageExecutionRepository unavailable");
        }
        return stageExecutionRepository.save(stageExecution);
    }

    public StageExecution createStageExecutionTask(String projectId,
                                                   String kbId,
                                                   Long userId,
                                                   Long parentTaskRecordId,
                                                   String stageRunKey,
                                                   String type,
                                                   String typeId,
                                                   TaskStatus status,
                                                   String stagePayload,
                                                   Instant now) {
        String normalizedExecutorType = normalizeRequired(type, "type required");
        String executionType = resolveExecutionType(normalizedExecutorType, typeId, stagePayload);
        return createStageExecution(parentTaskRecordId, stageRunKey, normalizedExecutorType, executionType, status, stagePayload, now);
    }

    public Optional<Task> findLatestByTypeAndTypeId(String projectId, String type, String typeId) {
        return taskRepository.findLatestByTypeAndTypeId(projectId, type, typeId);
    }

    public Optional<Task> findLatestDocumentPipelineByDocId(String projectId, String docId) {
        return taskRepository.findLatestDocumentPipelineByDocId(projectId, docId);
    }

    public Optional<Task> findById(Long taskRecordId, String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return taskRepository.findById(taskRecordId);
        }
        return taskRepository.findById(taskRecordId, projectId);
    }

    public Optional<Task> findById(Long taskRecordId) {
        return taskRepository.findById(taskRecordId);
    }

    public Optional<Task> findVisibleByPublicTaskId(String publicTaskId, String projectId) {
        return taskRepository.findVisibleByPublicTaskId(publicTaskId, projectId);
    }

    public Optional<Task> findVisibleByPublicTaskIdAndUserId(String publicTaskId, Long userId) {
        return taskRepository.findVisibleByPublicTaskIdAndUserId(publicTaskId, userId);
    }

    public Optional<Task> findVisibleSearchPipelineByPublicTaskIdAndScope(String publicTaskId, Long userId,
                                                                          String projectId, String kbId) {
        return taskRepository.findVisibleSearchPipelineByPublicTaskIdAndScope(publicTaskId, userId, projectId, kbId);
    }

    public Optional<StageExecution> findStageExecutionById(Long stageExecutionId) {
        if (stageExecutionRepository == null) {
            return Optional.empty();
        }
        return stageExecutionRepository.findById(stageExecutionId);
    }

    public Optional<StageExecution> findLatestStageExecutionByTaskIdAndStageKey(Long taskId, String stageKey) {
        if (stageExecutionRepository == null) {
            return Optional.empty();
        }
        return stageExecutionRepository.findLatestByTaskIdAndStageKey(taskId, stageKey);
    }

    public Optional<StageExecution> findLatestStageExecutionByTaskIdAndStatus(Long taskId, TaskStatus status) {
        if (stageExecutionRepository == null) {
            return Optional.empty();
        }
        return stageExecutionRepository.findLatestByTaskIdAndStatus(taskId, status);
    }

    public List<StageExecution> findStageExecutionsByTaskId(Long taskId) {
        if (stageExecutionRepository == null) {
            return List.of();
        }
        return stageExecutionRepository.findByTaskIdOrderByCreatedAtDesc(taskId);
    }

    public TaskPage findByProjectAndKbIdAndTypesAndStatuses(String projectId, String kbId, Collection<String> types,
                                                            Collection<TaskStatus> statuses, int page, int size) {
        Collection<String> statusNames = statuses == null
                ? List.of()
                : statuses.stream().map(TaskStatus::name).collect(Collectors.toList());
        return taskRepository.findByProjectAndKbIdAndTypesAndStatuses(projectId, kbId, types, statusNames, page, size);
    }

    public List<Task> findByTypeAndStatusAndUpdatedAtBefore(String type, TaskStatus status, Instant updatedAt) {
        return taskRepository.findByTypeAndStatusAndUpdatedAtBefore(type, status, updatedAt);
    }

    public List<Task> findVisibleByStatusesAndUpdatedAtBefore(Collection<TaskStatus> statuses, Instant updatedAt) {
        return taskRepository.findVisibleByStatusesAndUpdatedAtBefore(statuses, updatedAt);
    }

    public void deleteByIdAndProjectId(Long taskRecordId, String projectId) {
        taskRepository.deleteByIdAndProjectId(taskRecordId, projectId);
    }

    public void deleteStageExecutionsByTaskId(Long taskId) {
        if (stageExecutionRepository == null) {
            return;
        }
        stageExecutionRepository.deleteByTaskId(taskId);
    }

    public void publishTaskCreated(Task task, Map<String, Object> stagePayload) {
        if (taskMqPublisher == null) {
            return;
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    taskMqPublisher.publishTaskCreated(task, stagePayload);
                }
            });
        } else {
            taskMqPublisher.publishTaskCreated(task, stagePayload);
        }
    }

    public void publishStageCommand(Task task, StageExecution stageExecution, Map<String, Object> stageInput) {
        if (taskMqPublisher == null) {
            return;
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    taskMqPublisher.publishStageCommand(task, stageExecution, stageInput);
                }
            });
        } else {
            taskMqPublisher.publishStageCommand(task, stageExecution, stageInput);
        }
    }

    public Map<String, Object> readJsonMap(String raw) {
        if (raw == null || raw.isBlank()) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "json parse failed");
        }
    }

    public Map<String, Object> readPipelineContext(Task task) {
        if (task == null) {
            return new HashMap<>();
        }
        return readJsonMap(task.getPipelineContext());
    }

    public Map<String, Object> readStageInput(StageExecution stageExecution) {
        if (stageExecution == null) {
            return new HashMap<>();
        }
        return readJsonMap(stageExecution.getInputJson());
    }

    public Map<String, Object> readStageOutput(StageExecution stageExecution) {
        if (stageExecution == null) {
            return new HashMap<>();
        }
        return readJsonMap(stageExecution.getOutputJson());
    }

    public Map<String, Object> readStageError(StageExecution stageExecution) {
        if (stageExecution == null) {
            return new HashMap<>();
        }
        return readJsonMap(stageExecution.getErrorJson());
    }

    public Map<String, Object> readViewData(Task task) {
        if (task == null) {
            return new HashMap<>();
        }
        return readJsonMap(task.getViewData());
    }

    public String writeJson(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "json serialize failed");
        }
    }

    private String extractInitialViewData(String type, String pipelineContext) {
        Map<String, Object> parsed = readJsonMap(pipelineContext);
        Map<String, Object> viewData = new HashMap<>();
        Object info = parsed.get("info");
        if (info != null) {
            viewData.put("info", info);
        }
        if (TaskTypes.TEMPLATE_PIPELINE.equals(type)
                || TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE.equals(type)
                || TaskTypes.SEARCH_PIPELINE.equals(type)) {
            Object rawDocRefs = parsed.get("docRefs");
            if (rawDocRefs instanceof List<?> refs && !refs.isEmpty()) {
                List<Map<String, Object>> normalizedDocRefs = refs.stream()
                        .filter(Map.class::isInstance)
                        .map(Map.class::cast)
                        .map(this::normalizeDocRef)
                        .filter(ref -> !ref.isEmpty())
                        .collect(Collectors.toList());
                if (!normalizedDocRefs.isEmpty()) {
                    viewData.put("docRefs", normalizedDocRefs);
                }
            }
        }
        if (TaskTypes.TEMPLATE_PIPELINE.equals(type)
                || TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE.equals(type)
                || TaskTypes.AGENT_PIPELINE.equals(type)) {
            Object pluginId = parsed.get("pluginId");
            if (pluginId instanceof String text && !text.isBlank()) {
                viewData.put("pluginId", text.trim());
            }
        }
        if (TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE.equals(type)) {
            // No extra publish-only identifier is exposed once version-based publishing is immutable.
        }
        if (TaskTypes.PPTPROMPT_PIPELINE.equals(type)) {
            Object promptMarkdown = parsed.get("promptMarkdown");
            if (promptMarkdown instanceof String text && !text.isBlank()) {
                viewData.put("promptMarkdown", text.trim());
            }
            Object pageId = parsed.get("pageId");
            if (pageId instanceof String text && !text.isBlank()) {
                viewData.put("pageId", text.trim());
            }
            Object pageTitle = parsed.get("pageTitle");
            if (pageTitle instanceof String text && !text.isBlank()) {
                viewData.put("pageTitle", text.trim());
            }
        }
        if (viewData.isEmpty()) {
            return null;
        }
        return writeJson(viewData);
    }

    private String resolveExecutionType(String executorType, String typeId, String stagePayload) {
        if (TaskTypes.DOC.equals(executorType)) {
            return TaskTypes.DOC;
        }
        if (!TaskTypes.AGENT.equals(executorType)) {
            return normalizeRequired(typeId, "typeId required");
        }
        Map<String, Object> payload = readJsonMap(stagePayload);
        Object raw = payload.get("agentTaskType");
        if (!(raw instanceof String text) || text.isBlank()) {
            return normalizeRequired(typeId, "typeId required");
        }
        return TaskWorkflowDefinitions.resolveAgentTaskType(text);
    }

    private Map<String, Object> normalizeDocRef(Map<?, ?> raw) {
        Map<String, Object> docRef = new HashMap<>();
        Object id = raw.get("id");
        if (id instanceof String text && !text.isBlank()) {
            docRef.put("id", text.trim());
        }
        Object name = raw.get("name");
        if (name instanceof String text && !text.isBlank()) {
            docRef.put("name", text.trim());
        }
        return docRef;
    }

    private String initialCurrentStage(String type, String pipelineContext) {
        if (!taskPipelineRegistry.isRegistered(type)) {
            return null;
        }
        return taskPipelineRegistry.require(type).initialStageKey(readJsonMap(pipelineContext));
    }

    private String normalizeRequired(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", message);
        }
        return value.trim();
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String resolveTemplatePluginId(Map<String, Object> pipelineContext) {
        Object agentTaskType = pipelineContext.get("pluginId");
        if (agentTaskType instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        throw new BizException("KB-400", "pluginId required");
    }
}
