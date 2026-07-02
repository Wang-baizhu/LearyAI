// Responsibility: Verify retention cleanup deletes expired task trees on real PostgreSQL.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.cleanup.TaskRetentionCleanupScheduler;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.domain.repository.StageExecutionRepository;
import com.notebook.learyAI.module.task.domain.repository.TaskRepository;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Transactional
class TaskRetentionCleanupSchedulerIntegrationTest extends AbstractPgRedisIntegrationTest {
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private StageExecutionRepository stageExecutionRepository;

    @Test
    @DisplayName("cleanupExpiredTasks: 过期父任务及其子任务应被删除，未过期任务保留")
    void cleanupExpiredTasks_shouldDeleteExpiredTaskTreeOnly() {
        String projectId = UUID.randomUUID().toString();
        Instant expiredAt = Instant.now().minus(8, ChronoUnit.DAYS);
        Instant recentAt = Instant.now().minus(2, ChronoUnit.DAYS);

        Task expiredParent = taskRepository.save(new Task(
                null, "task-expired-parent", projectId, "kb-1", 1L, TaskTypes.DOCUMENT_PIPELINE,
                TaskStatus.DONE, null, "{\"kbId\":\"kb-1\"}", null, "doc-expired", expiredAt, expiredAt
        ));
        StageExecution expiredChild = stageExecutionRepository.save(new StageExecution(
                null, expiredParent.getTaskRecordId(), TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY,
                TaskTypes.DOC, "doc-expired", TaskStatus.DONE, "{\"kbId\":\"kb-1\"}", null, null,
                1, expiredAt, expiredAt, expiredAt, expiredAt
        ));
        Task recentParent = taskRepository.save(new Task(
                null, "task-recent-parent", projectId, "kb-1", 1L, TaskTypes.TEMPLATE_PIPELINE,
                TaskStatus.FAILED, null, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-r4\",\"pluginId\":\"quiz\"}", null, "_", recentAt, recentAt
        ));

        TaskAppService taskAppService = new TaskAppService(
                taskRepository,
                stageExecutionRepository,
                null,
                new com.fasterxml.jackson.databind.ObjectMapper()
        );
        TaskRetentionCleanupScheduler scheduler = new TaskRetentionCleanupScheduler(taskAppService, 7);

        scheduler.cleanupExpiredTasks();

        assertFalse(taskRepository.findById(expiredParent.getTaskRecordId(), projectId).isPresent());
        assertFalse(stageExecutionRepository.findById(expiredChild.getId()).isPresent());
        assertTrue(taskRepository.findById(recentParent.getTaskRecordId(), projectId).isPresent());
    }
}
