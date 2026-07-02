// Responsibility: Handle agent stage status and project agent results to parent task view data.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineDefinition;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistry;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class AgentTaskStageStatusHandler implements TaskStageStatusHandler {
    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final TaskPipelineRegistry taskPipelineRegistry;

    public AgentTaskStageStatusHandler(TaskAppService taskAppService,
                                       TaskStatusService taskStatusService,
                                       TaskPipelineRegistry taskPipelineRegistry) {
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.taskPipelineRegistry = taskPipelineRegistry;
    }

    @Override
    public String executorType() {
        return TaskTypes.AGENT;
    }

    @Override
    public boolean allowsEmptyScope(com.notebook.learyAI.module.task.domain.model.StageExecution stageExecution) {
        return stageExecution != null
                && com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions.AGENT_PPTPROMPT_STAGE_RUN_KEY
                .equals(stageExecution.getStageKey());
    }

    @Override
    public void onStageStatusChanged(TaskStageStatusContext context) {
        Map<String, Object> patch = buildViewDataPatch(
                context.parentTask(),
                context.stageExecution(),
                context.status(),
                context.result(),
                context.info()
        );
        if (context.status() == TaskStatus.PROCESSING
                && supportsProcessingProjection(context.parentTask())) {
            taskStatusService.updateTaskStatus(
                    context.parentTask().getTaskRecordId(),
                    context.parentTask().getProjectId(),
                    TaskStatus.PROCESSING,
                    patch,
                    null,
                    normalizeChangeType(context.changeType(), "agent_stage_processing")
            );
            return;
        }
        if (context.status() == TaskStatus.DONE) {
            taskStatusService.updateTaskStatus(
                    context.parentTask().getTaskRecordId(),
                    context.parentTask().getProjectId(),
                    TaskStatus.DONE,
                    patch,
                    null,
                    normalizeChangeType(context.changeType(), "agent_stage_done")
            );
            return;
        }
        if (context.status() == TaskStatus.FAILED) {
            taskStatusService.updateTaskStatus(
                    context.parentTask().getTaskRecordId(),
                    context.parentTask().getProjectId(),
                    TaskStatus.FAILED,
                    patch,
                    context.info(),
                    normalizeChangeType(context.changeType(), "agent_stage_failed")
            );
        }
    }

    private Map<String, Object> buildViewDataPatch(Task parentTask,
                                                   com.notebook.learyAI.module.task.domain.model.StageExecution stageExecution,
                                                   TaskStatus status,
                                                   Map<String, Object> result,
                                                   String info) {
        TaskPipelineDefinition definition = taskPipelineRegistry.require(parentTask.getType());
        Map<String, Object> pipelineContext = taskAppService.readPipelineContext(parentTask);
        Map<String, Object> patch = new HashMap<>();
        patch.put("stage", TaskStagePatchSupport.buildStage(
                TaskTypes.AGENT,
                TaskStagePatchSupport.resolveStageRunKey(stageExecution, null),
                status
        ));
        String resolvedInfo = definition.resolveAgentInfo(parentTask, status, info, pipelineContext);
        TaskStagePatchSupport.putText(patch, "info", resolvedInfo);
        if (status == TaskStatus.PROCESSING) {
            TaskStagePatchSupport.putText(patch, "progressText", resolvedInfo);
            return patch;
        }
        if (status == TaskStatus.FAILED) {
            TaskStagePatchSupport.putText(patch, "failedReason", resolvedInfo);
            return patch;
        }
        if (status != TaskStatus.DONE || result == null || result.isEmpty()) {
            return patch;
        }
        TaskStagePatchSupport.putText(patch, "summary", TaskStagePatchSupport.readText(result.get("outputText")));
        Map<String, Object> output = new HashMap<>();
        TaskStagePatchSupport.putText(output, "type", definition.resolveAgentOutputType(parentTask));
        if (!output.isEmpty()) {
            patch.put("output", output);
        }
        definition.enrichAgentDoneViewData(patch, parentTask, pipelineContext, result);
        return patch;
    }

    private boolean supportsProcessingProjection(Task parentTask) {
        return TaskTypes.TEMPLATE_PIPELINE.equals(parentTask.getType())
                || TaskTypes.AGENT_PIPELINE.equals(parentTask.getType())
                || TaskTypes.SEARCH_PIPELINE.equals(parentTask.getType())
                || TaskTypes.PPTPROMPT_PIPELINE.equals(parentTask.getType());
    }

    private String normalizeChangeType(String origin, String fallback) {
        if (origin == null || origin.isBlank()) {
            return fallback;
        }
        return origin.trim();
    }
}
