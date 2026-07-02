// Responsibility: Mark long-running doc tasks as failed on schedule.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

@Service
public class KbDocTaskTimeoutScheduler {
    private static final String TASK_TYPE_DOCUMENT_PIPELINE = "document_pipeline";

    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;
    private final KbDocAppSupport support;
    private final long timeoutDays;

    public KbDocTaskTimeoutScheduler(TaskAppService taskAppService,
                                     TaskStatusService taskStatusService,
                                     KbDocAppSupport support,
                                     @Value("${kb.doc.task.timeout-days:1}") long timeoutDays) {
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
        this.support = support;
        this.timeoutDays = timeoutDays;
    }

    @Scheduled(cron = "${kb.doc.task.timeout-cron:0 0 3 * * ?}")
    @Transactional
    public void markTimeoutTasks() {
        long safeDays = timeoutDays <= 0 ? 1 : timeoutDays;
        Instant threshold = Instant.now().minus(Duration.ofDays(safeDays));
        List<Task> tasks = taskAppService.findByTypeAndStatusAndUpdatedAtBefore(
                TASK_TYPE_DOCUMENT_PIPELINE, TaskStatus.PROCESSING, threshold);
        for (Task task : tasks) {
            taskStatusService.updateTaskStatus(task.getTaskRecordId(), task.getProjectId(), TaskStatus.FAILED,
                    null, "processing timeout", "status_timeout");
        }
    }
}
