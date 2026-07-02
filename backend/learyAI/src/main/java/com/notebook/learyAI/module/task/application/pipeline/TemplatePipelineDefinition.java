// Responsibility: Define template pipeline normalization, plugin validation and agent stage planning.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.module.template.application.TemplatePluginRegistry;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class TemplatePipelineDefinition implements TaskPipelineDefinition {
    private final TemplatePluginRegistry templatePluginRegistry;

    public TemplatePipelineDefinition(TemplatePluginRegistry templatePluginRegistry) {
        this.templatePluginRegistry = templatePluginRegistry;
    }

    @Override
    public String pipelineType() {
        return TaskTypes.TEMPLATE_PIPELINE;
    }

    @Override
    public boolean externallyCreatable() {
        return true;
    }

    @Override
    public String normalizeTypeId(String rawTypeId) {
        return "_";
    }

    @Override
    public Map<String, Object> sanitizePipelineContext(Map<String, Object> pipelineContext, TaskPipelineCreateContext context) {
        Map<String, Object> resolved = TaskWorkflowDefinitions.sanitizeTemplatePipelineContext(pipelineContext);
        String pluginId = String.valueOf(resolved.get("pluginId"));
        if (!TaskWorkflowDefinitions.requiresTemplateManifestValidation(pluginId)) {
            throw new com.notebook.learyAI.shared.exception.BizException("KB-400", "pluginId invalid");
        }
        var manifest = templatePluginRegistry.requirePluginById(context.userId(), context.projectId(), pluginId);
        Map<String, Object> normalized = new HashMap<>(resolved);
        normalized.put("pluginId", manifest.getPluginId());
        normalized.put("agentTaskType", TaskWorkflowDefinitions.AGENT_TASK_TYPE_TEMPLATE);
        return normalized;
    }

    @Override
    public TaskStagePlan buildInitialStagePlan(Map<String, Object> pipelineContext) {
        return new TaskStagePlan(
                TaskTypes.AGENT,
                TaskWorkflowDefinitions.AGENT_TASK_TYPE_TEMPLATE,
                TaskWorkflowDefinitions.resolveTemplateStageRunKey(
                        TaskWorkflowDefinitions.normalizeRequiredText(pipelineContext.get("pluginId"), "pluginId required")
                ),
                TaskWorkflowDefinitions.buildTemplateStagePayload(pipelineContext)
        );
    }

    @Override
    public boolean singleStagePipeline() {
        return true;
    }

    @Override
    public String resolveAgentInfo(com.notebook.learyAI.module.task.domain.model.Task parentTask,
                                   com.notebook.learyAI.module.task.domain.model.TaskStatus status,
                                   String info,
                                   Map<String, Object> pipelineContext) {
        if (info != null && !info.isBlank()) {
            return info.trim();
        }
        return switch (status) {
            case PROCESSING -> "模板生成中...";
            case DONE -> "模板生成完成";
            case FAILED -> "模板生成失败";
            default -> null;
        };
    }

    @Override
    public String resolveAgentOutputType(com.notebook.learyAI.module.task.domain.model.Task parentTask) {
        return TaskWorkflowDefinitions.AGENT_TASK_TYPE_TEMPLATE;
    }
}
