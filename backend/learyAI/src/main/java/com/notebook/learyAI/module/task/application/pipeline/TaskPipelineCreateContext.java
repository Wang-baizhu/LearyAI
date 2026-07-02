// Responsibility: Carry caller context required to normalize task pipeline creation input.
package com.notebook.learyAI.module.task.application.pipeline;

public record TaskPipelineCreateContext(Long userId, String projectId) {
}
