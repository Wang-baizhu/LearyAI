// Responsibility: Share common view-data patch helpers across executor status handlers.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;

import java.util.HashMap;
import java.util.Map;

public final class TaskStagePatchSupport {
    private TaskStagePatchSupport() {
    }

    public static void putText(Map<String, Object> target, String key, String value) {
        if (target == null || key == null || key.isBlank() || value == null || value.isBlank()) {
            return;
        }
        target.put(key, value.trim());
    }

    public static String readText(Object value) {
        if (!(value instanceof String text) || text.isBlank()) {
            return null;
        }
        return text.trim();
    }

    public static Map<String, Object> buildStage(String type, String runKey, TaskStatus status) {
        Map<String, Object> stage = new HashMap<>();
        putText(stage, "type", type);
        putText(stage, "runKey", runKey);
        if (status != null) {
            stage.put("status", status.name());
        }
        return stage;
    }

    public static String resolveStageRunKey(StageExecution stageExecution, String fallback) {
        if (stageExecution == null) {
            return fallback;
        }
        if (stageExecution.getStageKey() != null && !stageExecution.getStageKey().isBlank()) {
            return stageExecution.getStageKey();
        }
        return fallback;
    }
}
