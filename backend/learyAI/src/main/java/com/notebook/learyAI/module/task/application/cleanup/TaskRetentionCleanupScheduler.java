// Responsibility: Delete terminal task trees after retention period expires.
package com.notebook.learyAI.module.task.application.cleanup;

import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

@Service
public class TaskRetentionCleanupScheduler {
    private final TaskAppService taskAppService;
    private final long retentionDays;

    public TaskRetentionCleanupScheduler(TaskAppService taskAppService,
                                         @Value("${task.retention.days:7}") long retentionDays) {
        this.taskAppService = taskAppService;
        this.retentionDays = retentionDays;
    }

    @Scheduled(cron = "${task.retention.cleanup-cron:0 30 3 * * ?}")
    @Transactional
    public void cleanupExpiredTasks() {
        if (retentionDays <= 0) {
            return;
        }
        Instant threshold = Instant.now().minus(Duration.ofDays(retentionDays));
        List<Task> expiredTasks = taskAppService.findVisibleByStatusesAndUpdatedAtBefore(
                List.of(TaskStatus.DONE, TaskStatus.FAILED), threshold
        );
        for (Task task : expiredTasks) {
            if (task.getTaskRecordId() == null || task.getProjectId() == null || task.getProjectId().isBlank()) {
                continue;
            }
            taskAppService.deleteStageExecutionsByTaskId(task.getTaskRecordId());
            taskAppService.deleteByIdAndProjectId(task.getTaskRecordId(), task.getProjectId());
        }
    }
}
