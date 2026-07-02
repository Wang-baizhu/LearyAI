// Responsibility: Return the minimal kb skill search result to callers.
package com.notebook.learyAI.module.skills.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

public class KbSkillSearchResponse {
    @Schema(type = "string")
    private final String taskId;
    private final boolean completed;
    private final String answer;
    private final String errorMessage;

    public KbSkillSearchResponse(String taskId,
                                 boolean completed,
                                 String answer,
                                 String errorMessage) {
        this.taskId = taskId;
        this.completed = completed;
        this.answer = answer;
        this.errorMessage = errorMessage;
    }

    public String getTaskId() {
        return taskId;
    }

    public boolean isCompleted() {
        return completed;
    }

    public String getAnswer() {
        return answer;
    }

    public String getErrorMessage() {
        return errorMessage;
    }
}
