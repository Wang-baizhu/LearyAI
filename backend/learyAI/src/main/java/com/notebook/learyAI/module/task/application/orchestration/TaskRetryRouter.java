// Responsibility: Decide retry target task for pipeline and stage retries.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistries;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistry;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
public class TaskRetryRouter {
    private final TaskAppService taskAppService;
    private final TaskPipelineRegistry taskPipelineRegistry;

    @Autowired
    public TaskRetryRouter(TaskAppService taskAppService, TaskPipelineRegistry taskPipelineRegistry) {
        this.taskAppService = taskAppService;
        this.taskPipelineRegistry = taskPipelineRegistry;
    }

    public TaskRetryRouter(TaskAppService taskAppService) {
        this(taskAppService, TaskPipelineRegistries.defaultRegistry());
    }

    public RetryDecision resolve(Task task) {
        if (task == null) {
            throw new BizException("KB-400", "task required");
        }
        if (!taskPipelineRegistry.isRegistered(task.getType())) {
            throw new BizException("KB-400", "retry target invalid");
        }
        StageExecution failedStage = findFailedStage(task);
        if (failedStage != null) {
            return RetryDecision.retryStage(task, failedStage, true);
        }
        return RetryDecision.retryPipeline(task);
    }

    private StageExecution findFailedStage(Task task) {
        Optional<StageExecution> stageExecution = taskAppService.findLatestStageExecutionByTaskIdAndStatus(
                task.getTaskRecordId(), TaskStatus.FAILED
        );
        if (stageExecution.isPresent()) {
            return stageExecution.get();
        }
        return null;
    }

    public record RetryDecision(Task pipelineTask,
                                StageExecution targetStage,
                                boolean needsMarkParentProcessing,
                                boolean pipelineRetry) {
        public static RetryDecision retryStage(Task pipelineTask, StageExecution targetStage,
                                               boolean needsMarkParentProcessing) {
            return new RetryDecision(pipelineTask, targetStage, needsMarkParentProcessing, false);
        }

        public static RetryDecision retryPipeline(Task pipelineTask) {
            return new RetryDecision(pipelineTask, null, false, true);
        }
    }
}
