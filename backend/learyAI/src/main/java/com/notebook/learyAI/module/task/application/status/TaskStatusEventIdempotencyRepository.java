// Responsibility: Provide idempotency persistence for task.status events.
package com.notebook.learyAI.module.task.application.status;

import com.notebook.learyAI.module.task.domain.model.TaskStatus;

import java.time.Instant;

public interface TaskStatusEventIdempotencyRepository {
    boolean markProcessed(String eventId, String projectId, Long taskRecordId, TaskStatus status, Instant processedAt);

    void deleteProcessedBefore(Instant threshold);
}
