// Responsibility: Verify scheduler deletes expired terminal task trees.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.cleanup.TaskRetentionCleanupScheduler;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskRetentionCleanupSchedulerTest {
    @Mock
    private TaskAppService taskAppService;

    @Test
    @DisplayName("cleanupExpiredTasks 应删除过期终态任务及其子任务")
    void cleanupExpiredTasks_shouldDeleteExpiredTaskTree() {
        TaskRetentionCleanupScheduler scheduler = new TaskRetentionCleanupScheduler(taskAppService, 7);
        Task task = new Task(1L, "task-1", "p1", "kb-1", 9L, TaskTypes.DOCUMENT_PIPELINE, TaskStatus.DONE,
                null, "{\"kbId\":\"kb-1\"}", null, "doc-1", Instant.now(), Instant.now());
        when(taskAppService.findVisibleByStatusesAndUpdatedAtBefore(
                eq(List.of(TaskStatus.DONE, TaskStatus.FAILED)), any(Instant.class)
        )).thenReturn(List.of(task));

        scheduler.cleanupExpiredTasks();

        verify(taskAppService).deleteStageExecutionsByTaskId(1L);
        verify(taskAppService).deleteByIdAndProjectId(1L, "p1");
    }

    @Test
    @DisplayName("cleanupExpiredTasks 在 retentionDays<=0 时应跳过")
    void cleanupExpiredTasks_whenRetentionDisabled_shouldSkip() {
        TaskRetentionCleanupScheduler scheduler = new TaskRetentionCleanupScheduler(taskAppService, 0);

        scheduler.cleanupExpiredTasks();

        verify(taskAppService, never()).findVisibleByStatusesAndUpdatedAtBefore(any(), any());
    }
}
