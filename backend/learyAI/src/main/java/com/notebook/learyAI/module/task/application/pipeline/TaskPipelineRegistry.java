// Responsibility: Register and resolve task pipeline definitions by pipeline type.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class TaskPipelineRegistry {
    private final Map<String, TaskPipelineDefinition> definitionsByType;

    public TaskPipelineRegistry(List<TaskPipelineDefinition> definitions) {
        Map<String, TaskPipelineDefinition> resolved = new LinkedHashMap<>();
        for (TaskPipelineDefinition definition : definitions) {
            resolved.put(definition.pipelineType(), definition);
        }
        this.definitionsByType = Map.copyOf(resolved);
    }

    public TaskPipelineDefinition require(String pipelineType) {
        TaskPipelineDefinition definition = definitionsByType.get(pipelineType);
        if (definition == null) {
            throw new BizException("KB-400", "type invalid");
        }
        return definition;
    }

    public boolean isRegistered(String pipelineType) {
        return definitionsByType.containsKey(pipelineType);
    }

    public boolean isExternallyCreatable(String pipelineType) {
        TaskPipelineDefinition definition = definitionsByType.get(pipelineType);
        return definition != null && definition.externallyCreatable();
    }
}
