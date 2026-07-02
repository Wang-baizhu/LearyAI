// Responsibility: Project search pipeline tasks into the minimal kb skill response contract.
package com.notebook.learyAI.module.skills.application;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillSearchResponse;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component
public class KbSkillSearchResponseAssembler {
    private final ObjectMapper objectMapper;

    public KbSkillSearchResponseAssembler(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public KbSkillSearchResponse toCompletedResponse(Task task) {
        boolean failed = task != null && task.getStatus() == TaskStatus.FAILED;
        return new KbSkillSearchResponse(
                task == null ? null : task.getPublicTaskId(),
                true,
                failed ? null : extractAnswer(task),
                failed ? extractFailedReason(task) : null
        );
    }

    public KbSkillSearchResponse toResponse(Task task) {
        if (isTerminal(task)) {
            return toCompletedResponse(task);
        }
        return toPendingResponse(task);
    }

    public KbSkillSearchResponse toPendingResponse(Task task) {
        return new KbSkillSearchResponse(
                task == null ? null : task.getPublicTaskId(),
                false,
                null,
                null
        );
    }

    private String extractAnswer(Task task) {
        if (task == null) {
            return null;
        }
        Map<String, Object> viewData = readJsonMap(task.getViewData());
        if (viewData == null) {
            return null;
        }
        Object summary = viewData.get("summary");
        if (!(summary instanceof String summaryText)) {
            return null;
        }
        return normalizeText(summaryText);
    }

    private String extractFailedReason(Task task) {
        if (task == null) {
            return null;
        }
        Map<String, Object> viewData = readJsonMap(task.getViewData());
        if (viewData != null) {
            Object failedReason = viewData.get("failedReason");
            if (failedReason instanceof String failedReasonText) {
                String normalized = normalizeText(failedReasonText);
                if (normalized != null) {
                    return normalized;
                }
            }
        }
        return null;
    }

    private boolean isTerminal(Task task) {
        if (task == null || task.getStatus() == null) {
            return false;
        }
        return task.getStatus() == TaskStatus.DONE || task.getStatus() == TaskStatus.FAILED;
    }

    private Map<String, Object> readJsonMap(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {
            });
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("kb skill search viewData parse failed", ex);
        }
    }

    private String normalizeText(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }
}
