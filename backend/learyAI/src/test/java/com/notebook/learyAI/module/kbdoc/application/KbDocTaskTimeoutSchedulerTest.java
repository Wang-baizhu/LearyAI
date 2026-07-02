// Responsibility: Verify scheduler marks timed-out doc tasks as failed.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbDocTaskTimeoutSchedulerTest {
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private KbDocAppSupport support;

    @Test
    @DisplayName("markTimeoutTasks 应扫描超时任务并更新为 FAILED")
    void markTimeoutTasks_shouldUpdateFailedWithTimeoutMetadata() {
        KbDocTaskTimeoutScheduler scheduler = new KbDocTaskTimeoutScheduler(
                taskAppService, taskStatusService, support, 1
        );
        Task task = new Task(1L, "task-1", "p1", "kb-1", 1L, "document_pipeline", TaskStatus.PROCESSING,
                null, "{}", null, "doc-1", Instant.now(), Instant.now());
        when(taskAppService.findByTypeAndStatusAndUpdatedAtBefore(eq("document_pipeline"), eq(TaskStatus.PROCESSING), any(Instant.class)))
                .thenReturn(List.of(task));

        scheduler.markTimeoutTasks();

        verify(taskStatusService).updateTaskStatus(1L, "p1", TaskStatus.FAILED,
                null, "processing timeout", "status_timeout");
    }
}
