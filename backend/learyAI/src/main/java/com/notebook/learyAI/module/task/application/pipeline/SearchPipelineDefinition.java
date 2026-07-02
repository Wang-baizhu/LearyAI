// Responsibility: Define internal search pipeline normalization and agent stage planning.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class SearchPipelineDefinition implements TaskPipelineDefinition {
    @Override
    public String pipelineType() {
        return TaskTypes.SEARCH_PIPELINE;
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
        return TaskWorkflowDefinitions.sanitizeSearchPipelineContext(pipelineContext);
    }

    @Override
    public TaskStagePlan buildInitialStagePlan(Map<String, Object> pipelineContext) {
        return new TaskStagePlan(
                TaskTypes.AGENT,
                TaskWorkflowDefinitions.AGENT_TASK_TYPE_SEARCH,
                TaskWorkflowDefinitions.AGENT_SEARCH_STAGE_RUN_KEY,
                TaskWorkflowDefinitions.buildSearchStagePayload(pipelineContext)
        );
    }

    @Override
    public boolean singleStagePipeline() {
        return true;
    }

    @Override
    public String resolveAgentInfo(Task parentTask, TaskStatus status, String info, Map<String, Object> pipelineContext) {
        return info;
    }

    @Override
    public String resolveAgentOutputType(Task parentTask) {
        return "search";
    }
}
