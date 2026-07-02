// Responsibility: Define document pipeline context normalization and initial doc stage planning.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.module.task.domain.model.Task;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class DocumentPipelineDefinition implements TaskPipelineDefinition {
    @Override
    public String pipelineType() {
        return TaskTypes.DOCUMENT_PIPELINE;
    }

    @Override
    public boolean externallyCreatable() {
        return true;
    }

    @Override
    public String normalizeTypeId(String rawTypeId) {
        return TaskWorkflowDefinitions.normalizeRequiredText(rawTypeId, "typeId required");
    }

    @Override
    public Map<String, Object> sanitizePipelineContext(Map<String, Object> pipelineContext, TaskPipelineCreateContext context) {
        Map<String, Object> resolved = new HashMap<>();
        if (pipelineContext != null && !pipelineContext.isEmpty()) {
            resolved.putAll(pipelineContext);
        }
        Object docId = resolved.get("docId");
        if (docId instanceof String text && !text.isBlank()) {
            resolved.put("docId", text.trim());
        }
        return resolved;
    }

    @Override
    public TaskStagePlan buildInitialStagePlan(Map<String, Object> pipelineContext) {
        return new TaskStagePlan(
                TaskTypes.DOC,
                TaskTypes.DOC,
                TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY,
                pipelineContext == null ? Map.of() : Map.copyOf(pipelineContext)
        );
    }

    @Override
    public String resolveAgentOutputType(Task parentTask) {
        return "summary";
    }
}
