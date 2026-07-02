// Responsibility: Handle task creation with permission checks and snapshot push.
package com.notebook.learyAI.module.task.application.service;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.template.application.TemplatePluginRegistry;
import com.notebook.learyAI.module.task.application.orchestration.TaskRetryRouter;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineCreateContext;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineDefinition;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistries;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistry;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.contract.command.TaskAgentCommandFactory;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Service
public class TaskCommandAppService {
    private final TaskPipelineRegistry taskPipelineRegistry;
    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final TaskMqPublisher taskMqPublisher;
    private final TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    private final TaskRetryRouter taskRetryRouter;
    private final TaskAgentCommandFactory taskAgentCommandFactory;
    private final AuthzSdk authzSdk;

    @Autowired
    public TaskCommandAppService(TaskPipelineRegistry taskPipelineRegistry,
                                 TaskAppService taskAppService,
                                 TaskStatusService taskStatusService,
                                 TaskMqPublisher taskMqPublisher,
                                 TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                 TaskRetryRouter taskRetryRouter,
                                 TaskAgentCommandFactory taskAgentCommandFactory,
                                 AuthzSdk authzSdk) {
        this.taskPipelineRegistry = taskPipelineRegistry;
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.taskMqPublisher = taskMqPublisher;
        this.taskWorkflowOrchestrator = taskWorkflowOrchestrator;
        this.taskRetryRouter = taskRetryRouter;
        this.taskAgentCommandFactory = taskAgentCommandFactory;
        this.authzSdk = authzSdk;
    }

    public TaskCommandAppService(TaskAppService taskAppService,
                                 TaskStatusService taskStatusService,
                                 TaskMqPublisher taskMqPublisher,
                                 TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                 TaskRetryRouter taskRetryRouter,
                                 TaskAgentCommandFactory taskAgentCommandFactory,
                                 TemplatePluginRegistry templatePluginRegistry,
                                 AuthzSdk authzSdk,
                                 com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this(
                TaskPipelineRegistries.defaultRegistry(templatePluginRegistry),
                taskAppService,
                taskStatusService,
                taskMqPublisher,
                taskWorkflowOrchestrator,
                taskRetryRouter,
                taskAgentCommandFactory,
                authzSdk
        );
    }

    @Transactional
    public Task createTask(String projectId, String type, String typeId, TaskStatus status, String kbId,
                           Map<String, Object> pipelineContext, String info, String changeType) {
        Long userId = authzSdk.requireUserId();
        String normalizedType = normalizeRequired(type, "type");
        TaskPipelineDefinition definition = taskPipelineRegistry.require(normalizedType);
        if (!definition.externallyCreatable()) {
            throw new BizException("KB-400", "type invalid");
        }
        boolean pptPromptPipeline = TaskTypes.PPTPROMPT_PIPELINE.equals(normalizedType);
        // `pptprompt_pipeline` 为无 scope 任务，不占用真实 project/kb。
        String normalizedProjectId = pptPromptPipeline
                ? null
                : authzSdk.requireProjectId(projectId, "KB-400", "KB-400", "KB-404");
        String normalizedKbId = pptPromptPipeline
                ? null
                : normalizeRequired(kbId, "kbId");
        if (!pptPromptPipeline) {
            try {
                authzSdk.requireRole(userId, normalizedProjectId, java.util.Set.of(
                        com.notebook.learyAI.module.authz.domain.model.ProjectRole.OWNER,
                        com.notebook.learyAI.module.authz.domain.model.ProjectRole.ADMIN,
                        com.notebook.learyAI.module.authz.domain.model.ProjectRole.MEMBER));
            } catch (BizException ex) {
                if ("PROJECT-403".equals(ex.getCode())) {
                    throw new BizException("KB-403", "project access denied");
                }
                throw ex;
            }
        }
        String normalizedTypeId = definition.normalizeTypeId(typeId);
        if (status == null) {
            throw new BizException("KB-400", "status required");
        }
        Map<String, Object> normalizedPipelineContext = new HashMap<>();
        if (pipelineContext != null && !pipelineContext.isEmpty()) {
            normalizedPipelineContext.putAll(pipelineContext);
        }
        if (info != null && !info.isBlank()) {
            normalizedPipelineContext.put("info", info.trim());
        }
        if (TaskTypes.DOCUMENT_PIPELINE.equals(normalizedType)) {
            normalizedPipelineContext.putIfAbsent("docId", normalizedTypeId);
        }
        normalizedPipelineContext = definition.sanitizePipelineContext(
                normalizedPipelineContext,
                new TaskPipelineCreateContext(userId, normalizedProjectId)
        );
        String pipelineContextJson = taskAppService.writeJson(normalizedPipelineContext);
        Task task = taskAppService.createVisibleTask(
                normalizedProjectId,
                normalizedKbId,
                userId,
                normalizedType,
                normalizedTypeId,
                status,
                pipelineContextJson,
                Instant.now()
        );
        startPipelineTask(task, normalizedPipelineContext, userId);
        taskStatusService.publishSnapshot(task, normalizeChangeType(changeType));
        return task;
    }

    @Transactional
    public void retryTask(String projectId, String kbId, String publicTaskId) {
        Long userId = authzSdk.requireUserId();
        String normalizedProjectId = authzSdk.requireProjectId(projectId, "KB-400", "KB-400", "KB-404");
        String normalizedKbId = normalizeRequired(kbId, "kbId");
        try {
            authzSdk.requireRole(userId, normalizedProjectId, java.util.Set.of(
                    com.notebook.learyAI.module.authz.domain.model.ProjectRole.OWNER,
                    com.notebook.learyAI.module.authz.domain.model.ProjectRole.ADMIN,
                    com.notebook.learyAI.module.authz.domain.model.ProjectRole.MEMBER));
        } catch (BizException ex) {
            if ("PROJECT-403".equals(ex.getCode())) {
                throw new BizException("KB-403", "project access denied");
            }
            throw ex;
        }
        if (publicTaskId == null || publicTaskId.isBlank()) {
            throw new BizException("KB-400", "taskId required");
        }
        Task task = taskAppService.findVisibleByPublicTaskId(publicTaskId.trim(), normalizedProjectId)
                .orElseThrow(() -> new BizException("KB-404", "task not found"));
        if (task.getKbId() == null || !normalizedKbId.equals(task.getKbId().trim())) {
            throw new BizException("KB-404", "task not found");
        }
        TaskRetryRouter.RetryDecision decision = taskRetryRouter.resolve(task);
        if (decision.needsMarkParentProcessing()) {
            taskStatusService.updateTaskStatus(task.getTaskRecordId(), normalizedProjectId, TaskStatus.PROCESSING,
                    null, null, "retry_stage");
        }
        if (decision.pipelineRetry()) {
            Map<String, Object> pipelineContext = taskAppService.readPipelineContext(task);
            taskStatusService.updateTaskStatus(task.getTaskRecordId(), normalizedProjectId, TaskStatus.PROCESSING,
                    null, null, "retry");
            if (resumePipelineTask(task, pipelineContext, normalizedProjectId, normalizedKbId, userId)) {
                return;
            }
            startPipelineTask(task, pipelineContext, userId);
            return;
        }
        if (decision.targetStage() != null) {
            retryStageExecution(decision.pipelineTask(), decision.targetStage(), normalizedProjectId, normalizedKbId, userId);
            return;
        }
        throw new BizException("KB-400", "retry target invalid");
    }

    private boolean resumePipelineTask(Task pipelineTask, Map<String, Object> pipelineContext, String projectId,
                                       String kbId, Long userId) {
        if (pipelineTask == null) {
            return false;
        }
        if (TaskTypes.DOCUMENT_PIPELINE.equals(pipelineTask.getType())) {
            return resumeDocumentPipelineTask(pipelineTask, projectId, kbId, userId);
        }
        TaskPipelineDefinition definition = taskPipelineRegistry.require(pipelineTask.getType());
        if (!definition.singleStagePipeline()) {
            return false;
        }
        return resumeSingleStagePipelineTask(pipelineTask, pipelineContext, definition, projectId, kbId, userId);
    }

    private void startPipelineTask(Task task, Map<String, Object> pipelineContext, Long userId) {
        taskPipelineRegistry.require(task.getType());
        taskWorkflowOrchestrator.startPipeline(task, pipelineContext, userId);
    }

    private boolean resumeDocumentPipelineTask(Task pipelineTask, String projectId, String kbId, Long userId) {
        StageExecution docStage = taskAppService.findLatestStageExecutionByTaskIdAndStageKey(
                pipelineTask.getTaskRecordId(), TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY
        ).orElse(null);
        if (docStage == null) {
            return false;
        }
        if (docStage.getStatus() != TaskStatus.DONE) {
            retryStageExecution(pipelineTask, docStage, projectId, kbId, userId);
            return true;
        }
        StageExecution summaryStage = taskAppService.findLatestStageExecutionByTaskIdAndStageKey(
                pipelineTask.getTaskRecordId(), TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY
        ).orElse(null);
        if (summaryStage == null) {
            taskWorkflowOrchestrator.onStageStatusChanged(docStage, projectId, TaskStatus.DONE,
                    taskAppService.readStageOutput(docStage), null, kbId, userId, "retry_resume");
            return true;
        }
        if (summaryStage.getStatus() == TaskStatus.DONE) {
            taskWorkflowOrchestrator.onStageStatusChanged(summaryStage, projectId, TaskStatus.DONE,
                    taskAppService.readStageOutput(summaryStage), null, kbId, userId, "retry_resume");
            return true;
        }
        retryStageExecution(pipelineTask, summaryStage, projectId, kbId, userId);
        return true;
    }

    private boolean resumeSingleStagePipelineTask(Task pipelineTask,
                                                  Map<String, Object> pipelineContext,
                                                  TaskPipelineDefinition definition,
                                                  String projectId,
                                                  String kbId,
                                                  Long userId) {
        String stageRunKey = definition.initialStageKey(pipelineContext);
        StageExecution templateStage = taskAppService.findLatestStageExecutionByTaskIdAndStageKey(
                pipelineTask.getTaskRecordId(), stageRunKey
        ).orElse(null);
        if (templateStage == null) {
            return false;
        }
        if (templateStage.getStatus() == TaskStatus.DONE) {
            taskWorkflowOrchestrator.onStageStatusChanged(templateStage, projectId, TaskStatus.DONE,
                    taskAppService.readStageOutput(templateStage), null, kbId, userId, "retry_resume");
            return true;
        }
        retryStageExecution(pipelineTask, templateStage, projectId, kbId, userId);
        return true;
    }

    private void retryStageExecution(Task pipelineTask,
                                     StageExecution stageExecution,
                                     String projectId,
                                     String kbId,
                                     Long userId) {
        if (pipelineTask == null || stageExecution == null) {
            throw new BizException("KB-400", "retry target invalid");
        }
        Map<String, Object> stageInput = taskAppService.readStageInput(stageExecution);
        StageExecution saved = taskStatusService.retryStageExecution(pipelineTask, stageExecution, "retry")
                .map(TaskStatusService.StageStatusApplyResult::stageExecution)
                .orElse(stageExecution);
        if (TaskTypes.AGENT.equals(saved.getExecutorType())) {
            taskMqPublisher.publishAgentRunCommand(
                    taskAgentCommandFactory.create(
                            pipelineTask,
                            saved,
                            stageInput,
                            userId == null ? pipelineTask.getUserId() : userId
                    )
            );
            return;
        }
        if (TaskTypes.DOC.equals(saved.getExecutorType())
                || TaskTypes.TEMPLATE_PLUGIN_PUBLISH.equals(saved.getExecutorType())) {
            taskAppService.publishStageCommand(pipelineTask, saved, stageInput);
            return;
        }
        throw new BizException("KB-400", "retry target invalid");
    }

    private String normalizeRequired(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", name + " required");
        }
        return value.trim();
    }

    private String normalizeChangeType(String changeType) {
        if (changeType == null || changeType.isBlank()) {
            return "status_snapshot";
        }
        return changeType.trim();
    }
}
