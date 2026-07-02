// Responsibility: Delete expired task.status idempotency records after retention period.
package com.notebook.learyAI.module.task.application.cleanup;

import com.notebook.learyAI.module.task.application.status.TaskStatusEventIdempotencyRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class TaskStatusEventRetentionCleanupScheduler {
    private final TaskStatusEventIdempotencyRepository idempotencyRepository;
    private final long retentionDays;

    public TaskStatusEventRetentionCleanupScheduler(TaskStatusEventIdempotencyRepository idempotencyRepository,
                                                    @Value("${task.status-event.retention.days:8}") long retentionDays) {
        this.idempotencyRepository = idempotencyRepository;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${task.status-event.retention.cleanup-cron:0 45 3 * * ?}")
    @Transactional
    public void cleanupExpiredEvents() {
        if (retentionDays <= 0) {
            return;
        }
        Instant threshold = Instant.now().minus(Duration.ofDays(retentionDays));
        idempotencyRepository.deleteProcessedBefore(threshold);
    }
}
