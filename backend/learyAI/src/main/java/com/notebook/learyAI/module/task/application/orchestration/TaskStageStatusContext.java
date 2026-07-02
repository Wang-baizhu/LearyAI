// Responsibility: Carry parent/stage/status facts for executor-specific status handling.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;

import java.util.Map;

public record TaskStageStatusContext(Task parentTask,
                                     StageExecution stageExecution,
                                     TaskStatus status,
                                     Map<String, Object> result,
                                     String info,
                                     String kbId,
                                     Long userId,
                                     String changeType) {
}
