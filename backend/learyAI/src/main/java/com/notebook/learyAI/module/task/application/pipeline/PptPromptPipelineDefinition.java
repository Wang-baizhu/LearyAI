// Responsibility: Define ppt prompt pipeline normalization, stage planning and result projection.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class PptPromptPipelineDefinition implements TaskPipelineDefinition {
    @Override
    public String pipelineType() {
        return TaskTypes.PPTPROMPT_PIPELINE;
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
        return TaskWorkflowDefinitions.sanitizePptPromptPipelineContext(pipelineContext);
    }

    @Override
    public TaskStagePlan buildInitialStagePlan(Map<String, Object> pipelineContext) {
        return new TaskStagePlan(
                TaskTypes.AGENT,
                TaskWorkflowDefinitions.AGENT_TASK_TYPE_PPTPROMPT,
                TaskWorkflowDefinitions.AGENT_PPTPROMPT_STAGE_RUN_KEY,
                TaskWorkflowDefinitions.buildPptPromptStagePayload(pipelineContext)
        );
    }

    @Override
    public boolean singleStagePipeline() {
        return true;
    }

    @Override
    public String resolveAgentInfo(Task parentTask, TaskStatus status, String info, Map<String, Object> pipelineContext) {
        if (info != null && !info.isBlank()) {
            return info.trim();
        }
        return switch (status) {
            case PROCESSING -> "PPT Prompt 生成中...";
            case DONE -> "PPT Prompt 生成完成";
            case FAILED -> "PPT Prompt 生成失败";
            default -> null;
        };
    }

    @Override
    public String resolveAgentOutputType(Task parentTask) {
        return TaskWorkflowDefinitions.AGENT_TASK_TYPE_PPTPROMPT;
    }

    @Override
    public void enrichAgentDoneViewData(Map<String, Object> patch,
                                        Task parentTask,
                                        Map<String, Object> pipelineContext,
                                        Map<String, Object> result) {
        if (pipelineContext == null || patch == null) {
            return;
        }
        putText(patch, "promptMarkdown", pipelineContext.get("promptMarkdown"));
        putText(patch, "pageId", pipelineContext.get("pageId"));
        putText(patch, "pageTitle", pipelineContext.get("pageTitle"));
        if (result != null && !result.isEmpty()) {
            putText(patch, "generatedPrompt", result.get("outputText"));
            patch.put("result", new HashMap<>(result));
        }
    }

    private void putText(Map<String, Object> target, String key, Object rawValue) {
        if (!(rawValue instanceof String text) || text.isBlank()) {
            return;
        }
        target.put(key, text.trim());
    }
}
