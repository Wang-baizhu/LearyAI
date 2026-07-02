// Responsibility: Describe task.status MQ consume outcome for idempotent processing.
package com.notebook.learyAI.module.task.application.status;

public enum TaskStatusConsumeResult {
    PROCESSED,
    DUPLICATE
}
