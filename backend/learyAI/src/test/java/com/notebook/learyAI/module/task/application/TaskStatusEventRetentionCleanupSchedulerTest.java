// Responsibility: Verify scheduler deletes expired task.status idempotency records.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.cleanup.TaskStatusEventRetentionCleanupScheduler;
import com.notebook.learyAI.module.task.application.status.TaskStatusEventIdempotencyRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TaskStatusEventRetentionCleanupSchedulerTest {
    @Mock
    private TaskStatusEventIdempotencyRepository idempotencyRepository;

    @Test
    @DisplayName("cleanupExpiredEvents 应删除保留期外的状态事件幂等记录")
    void cleanupExpiredEvents_shouldDeleteExpiredRecords() {
        TaskStatusEventRetentionCleanupScheduler scheduler = new TaskStatusEventRetentionCleanupScheduler(
                idempotencyRepository, 8
        );

        scheduler.cleanupExpiredEvents();

        verify(idempotencyRepository).deleteProcessedBefore(any(Instant.class));
    }

    @Test
    @DisplayName("cleanupExpiredEvents 在 retentionDays<=0 时应跳过")
    void cleanupExpiredEvents_whenRetentionDisabled_shouldSkip() {
        TaskStatusEventRetentionCleanupScheduler scheduler = new TaskStatusEventRetentionCleanupScheduler(
                idempotencyRepository, 0
        );

        scheduler.cleanupExpiredEvents();

        verify(idempotencyRepository, never()).deleteProcessedBefore(any());
    }
}
