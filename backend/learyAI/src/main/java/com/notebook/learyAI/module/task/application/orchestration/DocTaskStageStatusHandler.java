// Responsibility: Handle doc stage status and continue document pipeline orchestration.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class DocTaskStageStatusHandler implements TaskStageStatusHandler {
    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final TaskStageExecutionCoordinator stageExecutionCoordinator;
    private final KbDocRepository kbDocRepository;
    private final KbDocQueryCache kbDocQueryCache;

    public DocTaskStageStatusHandler(TaskAppService taskAppService,
                                     TaskStatusService taskStatusService,
                                     TaskStageExecutionCoordinator stageExecutionCoordinator,
                                     KbDocRepository kbDocRepository,
                                     KbDocQueryCache kbDocQueryCache) {
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.stageExecutionCoordinator = stageExecutionCoordinator;
        this.kbDocRepository = kbDocRepository;
        this.kbDocQueryCache = kbDocQueryCache;
    }

    @Override
    public String executorType() {
        return TaskTypes.DOC;
    }

    @Override
    public void onStageStatusChanged(TaskStageStatusContext context) {
        if (context.status() == TaskStatus.DONE) {
            handleDone(context);
            return;
        }
        if (context.status() == TaskStatus.FAILED) {
            Map<String, Object> patch = new HashMap<>();
            patch.put("stage", TaskStagePatchSupport.buildStage(
                    TaskTypes.DOC,
                    TaskStagePatchSupport.resolveStageRunKey(context.stageExecution(), TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY),
                    context.status()
            ));
            TaskStagePatchSupport.putText(patch, "info", context.info());
            TaskStagePatchSupport.putText(patch, "failedReason", context.info());
            taskStatusService.updateTaskStatus(
                    context.parentTask().getTaskRecordId(),
                    context.parentTask().getProjectId(),
                    TaskStatus.FAILED,
                    patch,
                    context.info(),
                    normalizeChangeType(context.changeType(), "doc_stage_failed")
            );
        }
    }

    private void handleDone(TaskStageStatusContext context) {
        Task parentTask = context.parentTask();
        String docId = requireDocId(parentTask);
        kbDocRepository.updateStatusByDocId(parentTask.getProjectId(), docId, TaskStatus.DONE.name());
        kbDocQueryCache.evictDocByDocId(parentTask.getProjectId(), docId);
        StageExecution existedSummaryStage = taskAppService.findLatestStageExecutionByTaskIdAndStageKey(
                parentTask.getTaskRecordId(), TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY
        ).orElse(null);
        if (existedSummaryStage != null) {
            return;
        }
        Map<String, Object> sourcePayload = taskAppService.readStageInput(context.stageExecution());
        Map<String, Object> stageOutput = taskAppService.readStageOutput(context.stageExecution());
        Object docName = stageOutput.get("name") == null ? sourcePayload.get("name") : stageOutput.get("name");
        String resolvedDocName = docName == null ? docId : String.valueOf(docName);
        Map<String, Object> summaryStageInput = Map.of(
                "agentTaskType", TaskWorkflowDefinitions.AGENT_TASK_TYPE_KB_SUMMARY,
                "docRefs", java.util.List.of(Map.of("id", docId, "name", resolvedDocName))
        );
        TaskStageExecutionCoordinator.StageCreationResult stageResult = stageExecutionCoordinator.createStageExecutionIdempotently(
                parentTask,
                context.userId(),
                TaskTypes.AGENT,
                TaskWorkflowDefinitions.AGENT_TASK_TYPE_KB_SUMMARY,
                stageExecutionCoordinator.writeJson(summaryStageInput),
                TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY
        );
        if (!stageResult.created()) {
            return;
        }
        taskStatusService.updateTaskStatus(
                parentTask.getTaskRecordId(),
                parentTask.getProjectId(),
                TaskStatus.PROCESSING,
                Map.of("stage", TaskStagePatchSupport.buildStage(
                        TaskTypes.AGENT,
                        TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                        TaskStatus.PROCESSING
                )),
                null,
                normalizeChangeType(context.changeType(), "doc_stage_done")
        );
        stageExecutionCoordinator.publishStagePlan(
                parentTask,
                stageResult.stageExecution(),
                new com.notebook.learyAI.module.task.application.pipeline.TaskStagePlan(
                        TaskTypes.AGENT,
                        TaskWorkflowDefinitions.AGENT_TASK_TYPE_KB_SUMMARY,
                        TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                        summaryStageInput
                ),
                context.userId()
        );
    }

    private String requireDocId(Task parentTask) {
        Object raw = taskAppService.readPipelineContext(parentTask).get("docId");
        if (raw instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        throw new BizException("KB-400", "docId required");
    }

    private String normalizeChangeType(String origin, String fallback) {
        if (origin == null || origin.isBlank()) {
            return fallback;
        }
        return origin.trim();
    }
}
