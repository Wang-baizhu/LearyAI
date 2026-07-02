// Responsibility: Create stage executions idempotently and publish their commands.
package com.notebook.learyAI.module.task.application.orchestration;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.pipeline.TaskStagePlan;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.contract.command.TaskAgentCommandFactory;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

@Component
public class TaskStageExecutionCoordinator {
    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final TaskMqPublisher taskMqPublisher;
    private final TaskAgentCommandFactory taskAgentCommandFactory;
    private final ObjectMapper objectMapper;

    public TaskStageExecutionCoordinator(TaskAppService taskAppService,
                                         TaskStatusService taskStatusService,
                                         TaskMqPublisher taskMqPublisher,
                                         TaskAgentCommandFactory taskAgentCommandFactory,
                                         ObjectMapper objectMapper) {
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.taskMqPublisher = taskMqPublisher;
        this.taskAgentCommandFactory = taskAgentCommandFactory;
        this.objectMapper = objectMapper;
    }

    public StageCreationResult createStageExecutionIdempotently(Task parentTask,
                                                                Long userId,
                                                                String executorType,
                                                                String executionType,
                                                                String stageInputJson,
                                                                String stageKey) {
        try {
            return new StageCreationResult(
                    taskAppService.createStageExecutionTask(
                            parentTask.getProjectId(),
                            parentTask.getKbId(),
                            userId == null ? parentTask.getUserId() : userId,
                            parentTask.getTaskRecordId(),
                            stageKey,
                            executorType,
                            executionType,
                            TaskStatus.PROCESSING,
                            stageInputJson,
                            Instant.now()
                    ),
                    true
            );
        } catch (DataIntegrityViolationException ex) {
            StageExecution existing = taskAppService.findLatestStageExecutionByTaskIdAndStageKey(
                    parentTask.getTaskRecordId(), stageKey
            ).orElseThrow(() -> ex);
            return new StageCreationResult(existing, false);
        }
    }

    public void publishStagePlan(Task pipelineTask,
                                 StageExecution stageExecution,
                                 TaskStagePlan stagePlan,
                                 Long userId) {
        if (TaskTypes.AGENT.equals(stagePlan.executorType())) {
            taskMqPublisher.publishAgentRunCommand(
                    taskAgentCommandFactory.create(
                            pipelineTask,
                            stageExecution,
                            stagePlan.stagePayload(),
                            userId == null ? pipelineTask.getUserId() : userId
                    )
            );
            return;
        }
        if (TaskTypes.TEMPLATE_PLUGIN_PUBLISH.equals(stagePlan.executorType())) {
            taskStatusService.updateTaskStatus(
                    pipelineTask.getTaskRecordId(),
                    pipelineTask.getProjectId(),
                    TaskStatus.PROCESSING,
                    buildTemplatePluginPublishProcessingPatch(stagePlan.stagePayload()),
                    null,
                    "template_plugin_publish_processing"
            );
        }
        taskAppService.publishStageCommand(pipelineTask, stageExecution, stagePlan.stagePayload());
    }

    public String writeJson(Map<String, Object> payload) {
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "json serialize failed");
        }
    }

    private Map<String, Object> buildTemplatePluginPublishProcessingPatch(Map<String, Object> stagePayload) {
        Map<String, Object> patch = new HashMap<>();
        patch.put("stage", TaskStagePatchSupport.buildStage(
                TaskTypes.TEMPLATE_PLUGIN_PUBLISH,
                TaskWorkflowDefinitions.TEMPLATE_PLUGIN_PUBLISH_STAGE_RUN_KEY,
                TaskStatus.PROCESSING
        ));
        Object pluginId = stagePayload == null ? null : stagePayload.get("pluginId");
        if (pluginId instanceof String text && !text.isBlank()) {
            patch.put("pluginId", text.trim());
        }
        TaskStagePatchSupport.putText(patch, "info", "模板插件发布校验中...");
        TaskStagePatchSupport.putText(patch, "progressText", "模板插件发布校验中...");
        return patch;
    }

    public record StageCreationResult(StageExecution stageExecution, boolean created) {
    }
}
