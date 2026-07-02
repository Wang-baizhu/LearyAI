// Responsibility: Define internal template plugin publish validation pipeline planning.
package com.notebook.learyAI.module.task.application.pipeline;

import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class TemplatePluginPublishPipelineDefinition implements TaskPipelineDefinition {
    @Override
    public String pipelineType() {
        return TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE;
    }

    @Override
    public boolean externallyCreatable() {
        return false;
    }

    @Override
    public String normalizeTypeId(String rawTypeId) {
        return "_";
    }

    @Override
    public Map<String, Object> sanitizePipelineContext(Map<String, Object> pipelineContext, TaskPipelineCreateContext context) {
        return pipelineContext == null ? Map.of() : Map.copyOf(pipelineContext);
    }

    @Override
    public TaskStagePlan buildInitialStagePlan(Map<String, Object> pipelineContext) {
        return new TaskStagePlan(
                TaskTypes.TEMPLATE_PLUGIN_PUBLISH,
                TaskTypes.TEMPLATE_PLUGIN_PUBLISH,
                TaskWorkflowDefinitions.TEMPLATE_PLUGIN_PUBLISH_STAGE_RUN_KEY,
                pipelineContext == null ? Map.of() : Map.copyOf(pipelineContext)
        );
    }

    @Override
    public boolean singleStagePipeline() {
        return true;
    }

    @Override
    public boolean listable() {
        return false;
    }
}
