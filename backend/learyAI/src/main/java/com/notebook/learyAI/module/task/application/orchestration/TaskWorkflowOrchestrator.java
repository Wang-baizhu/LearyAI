// Responsibility: Orchestrate pipeline stages based on task status facts.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistries;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineDefinition;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistry;
import com.notebook.learyAI.module.task.application.pipeline.TaskStagePlan;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class TaskWorkflowOrchestrator {
    private final TaskAppService taskAppService;
    private final TaskPipelineRegistry taskPipelineRegistry;
    private final TaskStageExecutionCoordinator stageExecutionCoordinator;
    private final TaskStageStatusHandlerRegistry stageStatusHandlerRegistry;

    @Autowired
    public TaskWorkflowOrchestrator(TaskAppService taskAppService,
                                    TaskPipelineRegistry taskPipelineRegistry,
                                    TaskStageExecutionCoordinator stageExecutionCoordinator,
                                    TaskStageStatusHandlerRegistry stageStatusHandlerRegistry) {
        this.taskAppService = taskAppService;
        this.taskPipelineRegistry = taskPipelineRegistry;
        this.stageExecutionCoordinator = stageExecutionCoordinator;
        this.stageStatusHandlerRegistry = stageStatusHandlerRegistry;
    }

    public TaskWorkflowOrchestrator(TaskAppService taskAppService,
                                    TaskStageExecutionCoordinator stageExecutionCoordinator,
                                    TaskStageStatusHandlerRegistry stageStatusHandlerRegistry) {
        this(taskAppService, TaskPipelineRegistries.defaultRegistry(), stageExecutionCoordinator, stageStatusHandlerRegistry);
    }
    public void startPipeline(Task pipelineTask, Map<String, Object> pipelineContext, Long userId) {
        if (pipelineTask == null) {
            throw new BizException("KB-400", "pipelineTask required");
        }
        Map<String, Object> sourceContext = pipelineContext == null
                ? taskAppService.readPipelineContext(pipelineTask)
                : pipelineContext;
        TaskPipelineDefinition definition = taskPipelineRegistry.require(pipelineTask.getType());
        TaskStagePlan stagePlan = definition.buildInitialStagePlan(sourceContext);
        StageExecution existedStage = taskAppService.findLatestStageExecutionByTaskIdAndStageKey(
                pipelineTask.getTaskRecordId(), stagePlan.stageRunKey()
        ).orElse(null);
        if (existedStage != null) {
            return;
        }
        TaskStageExecutionCoordinator.StageCreationResult stageResult = stageExecutionCoordinator.createStageExecutionIdempotently(
                pipelineTask,
                userId,
                stagePlan.executorType(),
                stagePlan.executionType(),
                stageExecutionCoordinator.writeJson(stagePlan.stagePayload()),
                stagePlan.stageRunKey()
        );
        if (!stageResult.created()) {
            return;
        }
        stageExecutionCoordinator.publishStagePlan(pipelineTask, stageResult.stageExecution(), stagePlan, userId);
    }

    public void onStageStatusChanged(StageExecution stageExecution,
                                     String projectId,
                                     TaskStatus status,
                                     Map<String, Object> result,
                                     String info,
                                     String kbId,
                                     Long userId,
                                     String changeType) {
        if (stageExecution == null || status == null) {
            return;
        }
        Task parentTask = taskAppService.findById(stageExecution.getTaskId(), projectId)
                .orElseThrow(() -> new BizException("KB-404", "parent task not found"));
        TaskStageStatusHandler handler = stageStatusHandlerRegistry.require(stageExecution.getExecutorType());
        handler.onStageStatusChanged(new TaskStageStatusContext(
                parentTask,
                stageExecution,
                status,
                result,
                info,
                kbId,
                userId,
                changeType
        ));
    }
}
