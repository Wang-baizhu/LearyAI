// Responsibility: Handle executor-specific stage status facts without central branching.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.task.domain.model.StageExecution;

public interface TaskStageStatusHandler {
    String executorType();

    default boolean allowsEmptyScope(StageExecution stageExecution) {
        return false;
    }

    void onStageStatusChanged(TaskStageStatusContext context);
}
