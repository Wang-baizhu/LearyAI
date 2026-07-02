// Responsibility: Publish task creation messages.
package com.notebook.learyAI.module.task.application.port;

import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;

import java.util.Map;

public interface TaskMqPublisher {
    void publishStageCommand(Task task, StageExecution stageExecution, Map<String, Object> stageInput);

    void publishTaskCreated(Task task, Map<String, Object> stagePayload);

    void publishAgentRunCommand(Object command);
}
