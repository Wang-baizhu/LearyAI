// Responsibility: Define pipeline-specific task creation, stage planning and presentation behavior.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;

import java.util.Map;

public interface TaskPipelineDefinition {
    String pipelineType();

    boolean externallyCreatable();

    String normalizeTypeId(String rawTypeId);

    Map<String, Object> sanitizePipelineContext(Map<String, Object> pipelineContext, TaskPipelineCreateContext context);

    TaskStagePlan buildInitialStagePlan(Map<String, Object> pipelineContext);

    default String initialStageKey(Map<String, Object> pipelineContext) {
        return buildInitialStagePlan(pipelineContext).stageRunKey();
    }

    default boolean singleStagePipeline() {
        return false;
    }

    default boolean listable() {
        return true;
    }

    default String resolveAgentInfo(Task parentTask,
                                    TaskStatus status,
                                    String info,
                                    Map<String, Object> pipelineContext) {
        return info;
    }

    default String resolveAgentOutputType(Task parentTask) {
        return null;
    }

    default void enrichAgentDoneViewData(Map<String, Object> patch,
                                         Task parentTask,
                                         Map<String, Object> pipelineContext,
                                         Map<String, Object> result) {
    }
}
