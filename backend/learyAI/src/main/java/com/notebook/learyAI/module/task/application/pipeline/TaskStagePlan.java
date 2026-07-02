// Responsibility: Describe the initial stage to create for a pipeline definition.
package com.notebook.learyAI.module.task.application.pipeline;

import java.util.Map;

public record TaskStagePlan(String executorType,
                            String executionType,
                            String stageRunKey,
                            Map<String, Object> stagePayload) {
}
