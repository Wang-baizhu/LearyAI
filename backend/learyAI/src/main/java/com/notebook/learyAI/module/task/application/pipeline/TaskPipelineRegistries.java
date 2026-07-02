// Responsibility: Provide reusable default task pipeline registries for lightweight construction paths.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.module.template.application.TemplatePluginRegistry;

import java.util.List;
import java.util.Map;

public final class TaskPipelineRegistries {
    private TaskPipelineRegistries() {
    }

    public static TaskPipelineRegistry defaultRegistry() {
        return new TaskPipelineRegistry(List.of(
                new DocumentPipelineDefinition(),
                new AgentPipelineDefinition(),
                new SearchPipelineDefinition(),
                new TemplatePluginPublishPipelineDefinition(),
                new PptPromptPipelineDefinition(),
                templatePipelineDefinitionWithoutValidation()
        ));
    }

    public static TaskPipelineRegistry defaultRegistry(TemplatePluginRegistry templatePluginRegistry) {
        return new TaskPipelineRegistry(List.of(
                new DocumentPipelineDefinition(),
                new AgentPipelineDefinition(),
                new SearchPipelineDefinition(),
                new TemplatePluginPublishPipelineDefinition(),
                new PptPromptPipelineDefinition(),
                new TemplatePipelineDefinition(templatePluginRegistry)
        ));
    }

    private static TaskPipelineDefinition templatePipelineDefinitionWithoutValidation() {
        return new TaskPipelineDefinition() {
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
            public Map<String, Object> sanitizePipelineContext(Map<String, Object> pipelineContext,
                                                               TaskPipelineCreateContext context) {
                return TaskWorkflowDefinitions.sanitizeTemplatePipelineContext(pipelineContext);
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
        };
    }
}
