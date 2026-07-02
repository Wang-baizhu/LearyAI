// Responsibility: Register and resolve executor-specific stage status handlers.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class TaskStageStatusHandlerRegistry {
    private final Map<String, TaskStageStatusHandler> handlersByExecutorType;

    public TaskStageStatusHandlerRegistry(List<TaskStageStatusHandler> handlers) {
        Map<String, TaskStageStatusHandler> resolved = new LinkedHashMap<>();
        for (TaskStageStatusHandler handler : handlers) {
            resolved.put(handler.executorType(), handler);
        }
        this.handlersByExecutorType = Map.copyOf(resolved);
    }

    public TaskStageStatusHandler require(String executorType) {
        TaskStageStatusHandler handler = handlersByExecutorType.get(executorType);
        if (handler == null) {
            throw new BizException("KB-400", "taskType invalid");
        }
        return handler;
    }

    public boolean isRegistered(String executorType) {
        return handlersByExecutorType.containsKey(executorType);
    }
}
