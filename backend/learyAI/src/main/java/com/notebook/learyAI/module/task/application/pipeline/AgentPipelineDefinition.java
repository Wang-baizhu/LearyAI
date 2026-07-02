// Responsibility: Define kbview agent pipeline normalization and stage planning.
package com.notebook.learyAI.module.task.application.pipeline;

import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class AgentPipelineDefinition implements TaskPipelineDefinition {
    @Override
    public String pipelineType() {
        return TaskTypes.AGENT_PIPELINE;
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
        Map<String, Object> resolved = TaskWorkflowDefinitions.sanitizeAgentPipelineContext(pipelineContext);
        Map<String, Object> normalized = new HashMap<>(resolved);
        normalized.put("agentTaskType", TaskWorkflowDefinitions.AGENT_TASK_TYPE_KBVIEW);
        return normalized;
    }

    @Override
    public TaskStagePlan buildInitialStagePlan(Map<String, Object> pipelineContext) {
        return new TaskStagePlan(
                TaskTypes.AGENT,
                TaskWorkflowDefinitions.AGENT_TASK_TYPE_KBVIEW,
                TaskWorkflowDefinitions.AGENT_KBVIEW_STAGE_RUN_KEY,
                TaskWorkflowDefinitions.buildAgentStagePayload(pipelineContext)
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
            case PROCESSING -> "关系图生成中...";
            case DONE -> "关系图生成完成";
            case FAILED -> "关系图生成失败";
            default -> null;
        };
    }

    @Override
    public String resolveAgentOutputType(com.notebook.learyAI.module.task.domain.model.Task parentTask) {
        return TaskWorkflowDefinitions.AGENT_TASK_TYPE_KBVIEW;
    }
}
