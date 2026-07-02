// Responsibility: Verify retention cleanup deletes expired task.status event records on real PostgreSQL.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.cleanup.TaskStatusEventRetentionCleanupScheduler;
import com.notebook.learyAI.module.task.application.status.TaskStatusEventIdempotencyRepository;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.infrastructure.persistence.jpa.TaskStatusEventJpaRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskStatusEventPO;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Transactional
class TaskStatusEventRetentionCleanupSchedulerIntegrationTest extends AbstractPgRedisIntegrationTest {
    @Autowired
    private TaskStatusEventJpaRepository taskStatusEventJpaRepository;

    @Test
    @DisplayName("cleanupExpiredEvents: 过期状态事件应被删除，未过期记录保留")
    void cleanupExpiredEvents_shouldDeleteExpiredRecordsOnly() {
        TaskStatusEventPO expired = new TaskStatusEventPO();
        expired.setEventId("evt-expired-" + UUID.randomUUID());
        expired.setProjectId(UUID.randomUUID());
        expired.setTaskRecordId(1L);
        expired.setStatus(TaskStatus.DONE.name());
        expired.setProcessedAt(Instant.now().minus(9, ChronoUnit.DAYS));
        taskStatusEventJpaRepository.save(expired);

        TaskStatusEventPO recent = new TaskStatusEventPO();
        recent.setEventId("evt-recent-" + UUID.randomUUID());
        recent.setProjectId(UUID.randomUUID());
        recent.setTaskRecordId(2L);
        recent.setStatus(TaskStatus.FAILED.name());
        recent.setProcessedAt(Instant.now().minus(2, ChronoUnit.DAYS));
        taskStatusEventJpaRepository.save(recent);

        TaskStatusEventIdempotencyRepository repository =
                new com.notebook.learyAI.module.task.infrastructure.repository.TaskStatusEventIdempotencyRepositoryImpl(
                        taskStatusEventJpaRepository
                );
        TaskStatusEventRetentionCleanupScheduler scheduler =
                new TaskStatusEventRetentionCleanupScheduler(repository, 8);

        scheduler.cleanupExpiredEvents();

        List<String> remainingEventIds = taskStatusEventJpaRepository.findAll()
                .stream()
                .map(TaskStatusEventPO::getEventId)
                .toList();

        assertFalse(remainingEventIds.contains(expired.getEventId()));
        assertTrue(remainingEventIds.contains(recent.getEventId()));
    }
}
