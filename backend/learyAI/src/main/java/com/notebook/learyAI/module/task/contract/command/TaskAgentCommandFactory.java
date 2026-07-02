// Responsibility: Build typed task.command.agent.run contracts from stage payloads.
package com.notebook.learyAI.module.task.contract.command;

import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class TaskAgentCommandFactory {
    public AgentRunCommand create(Task task, StageExecution stageExecution, Map<String, Object> stagePayload, Long userId) {
        if (task == null) {
            throw new BizException("KB-400", "task required");
        }
        if (stageExecution == null) {
            throw new BizException("KB-400", "stageExecution required");
        }
        if (!TaskTypes.AGENT.equals(stageExecution.getExecutorType())) {
            throw new BizException("KB-400", "taskType must be agent");
        }
        String projectId = normalizeScopeValue(task.getProjectId(), task);
        String kbId = normalizeScopeValue(task.getKbId(), task);
        Long taskRecordId = requireTaskRecordId(stageExecution.getId());
        String stageRunKey = normalizeRequired(trimToNull(stageExecution.getStageKey()), "stageRunKey required");
        return new AgentRunCommand(
                UUID.randomUUID().toString(),
                "1.0",
                Instant.now().toString(),
                UUID.randomUUID().toString(),
                "backend",
                projectId,
                kbId,
                userId,
                taskRecordId,
                TaskTypes.AGENT,
                task.getTaskRecordId(),
                stageRunKey,
                new AgentPayload(
                        trimToNull(resolveTypeId(task, stageExecution, stagePayload)),
                        resolveAgentTaskType(stagePayload),
                        trimToNull(readString(stagePayload, "pluginId")),
                        TaskWorkflowDefinitions.normalizePromptVars(readMap(stagePayload, "promptVars")),
                        normalizeDocRefs(stagePayload == null ? null : stagePayload.get("docRefs")),
                        trimToNull(readString(stagePayload, "info")),
                        trimToNull(readString(stagePayload, "agentSessionId")),
                        trimToNull(readString(stagePayload, "modelConfigType"))
                )
        );
    }

    private String resolveTypeId(Task task, StageExecution stageExecution, Map<String, Object> stagePayload) {
        if (task != null && task.getTypeId() != null && !task.getTypeId().isBlank()) {
            return task.getTypeId();
        }
        if (stageExecution != null && TaskWorkflowDefinitions.AGENT_TASK_TYPE_SEARCH.equals(stageExecution.getExecutionType())) {
            return "_";
        }
        if (stagePayload == null) {
            return null;
        }
        Object rawDocRefs = stagePayload.get("docRefs");
        if (!(rawDocRefs instanceof List<?> refs) || refs.isEmpty()) {
            return null;
        }
        Object first = refs.get(0);
        if (!(first instanceof Map<?, ?> refMap)) {
            return null;
        }
        Object id = refMap.get("id");
        if (!(id instanceof String text) || text.isBlank()) {
            return null;
        }
        return text.trim();
    }

    private String resolveAgentTaskType(Map<String, Object> stagePayload) {
        if (stagePayload == null) {
            throw new BizException("KB-400", "agentTaskType required");
        }
        Object value = stagePayload.get("agentTaskType");
        if (!(value instanceof String text) || text.isBlank()) {
            throw new BizException("KB-400", "agentTaskType required");
        }
        return TaskWorkflowDefinitions.resolveAgentTaskType(text);
    }

    private Long requireTaskRecordId(Long taskRecordId) {
        if (taskRecordId == null || taskRecordId <= 0L) {
            throw new BizException("KB-400", "taskRecordId required");
        }
        return taskRecordId;
    }

    private String normalizeRequired(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", message);
        }
        return value.trim();
    }

    private String normalizeScopeValue(String value, Task task) {
        if (value == null || value.isBlank()) {
            if (task != null && TaskTypes.PPTPROMPT_PIPELINE.equals(task.getType())) {
                return null;
            }
            throw new BizException("KB-400", "task scope required");
        }
        return value.trim();
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String readString(Map<String, Object> stagePayload, String key) {
        if (stagePayload == null) {
            return null;
        }
        Object value = stagePayload.get(key);
        return value == null ? null : String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> readMap(Map<String, Object> stagePayload, String key) {
        if (stagePayload == null) {
            return null;
        }
        Object value = stagePayload.get(key);
        if (value == null) {
            return null;
        }
        if (!(value instanceof Map<?, ?> rawMap)) {
            throw new BizException("KB-400", key + " invalid");
        }
        return (Map<String, Object>) rawMap;
    }

    private List<TaskDocRef> normalizeDocRefs(Object rawDocRefs) {
        return TaskWorkflowDefinitions.normalizeDocRefs(rawDocRefs).stream()
                .map(ref -> new TaskDocRef(String.valueOf(ref.get("id")), ref.get("name") == null ? null : String.valueOf(ref.get("name"))))
                .toList();
    }
}
