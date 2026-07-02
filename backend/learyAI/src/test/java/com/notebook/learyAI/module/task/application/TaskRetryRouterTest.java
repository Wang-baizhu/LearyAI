// Responsibility: Verify retry routing decisions for pipeline and stage tasks.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.orchestration.TaskRetryRouter;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskRetryRouterTest {
    @Mock
    private TaskAppService taskAppService;

    @Test
    @DisplayName("resolve: 父流程有失败子阶段时应路由到子阶段")
    void resolve_whenParentHasFailedChild_shouldRouteStage() {
        TaskRetryRouter router = new TaskRetryRouter(taskAppService);
        Task parent = visibleTask(1L, "task-1", "p1", "kb-1", 9L, TaskTypes.DOCUMENT_PIPELINE, "doc-1",
                TaskStatus.FAILED, "{\"kbId\":\"kb-1\"}");
        StageExecution failedChild = stageTask(2L, 1L, TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                TaskTypes.AGENT, "doc-1", TaskStatus.FAILED, "{\"kbId\":\"kb-1\"}");
        when(taskAppService.findLatestStageExecutionByTaskIdAndStatus(1L, TaskStatus.FAILED))
                .thenReturn(Optional.of(failedChild));

        TaskRetryRouter.RetryDecision decision = router.resolve(parent);

        assertTrue(decision.needsMarkParentProcessing());
        assertFalse(decision.pipelineRetry());
    }

    @Test
    @DisplayName("resolve: template_pipeline 无失败子阶段时应返回流程重试")
    void resolve_whenTemplatePipelineWithoutFailedChild_shouldRetryPipeline() {
        TaskRetryRouter router = new TaskRetryRouter(taskAppService);
        Task pipelineTask = visibleTask(4L, "task-4", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.FAILED, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-r3\",\"pluginId\":\"mindmap\"}");
        when(taskAppService.findLatestStageExecutionByTaskIdAndStatus(4L, TaskStatus.FAILED))
                .thenReturn(Optional.empty());

        TaskRetryRouter.RetryDecision decision = router.resolve(pipelineTask);

        assertTrue(decision.pipelineRetry());
        assertEquals(4L, decision.pipelineTask().getTaskRecordId());
    }

    @Test
    @DisplayName("resolve: 非 pipeline 任务应拒绝重试路由")
    void resolve_whenRootAgentTask_shouldThrowKb400() {
        TaskRetryRouter router = new TaskRetryRouter(taskAppService);
        Task agentTask = visibleTask(5L, "task-5", "p1", "kb-1", 9L, TaskTypes.AGENT, "_",
                TaskStatus.FAILED, "{\"kbId\":\"kb-1\"}");

        BizException ex = org.junit.jupiter.api.Assertions.assertThrows(BizException.class, () -> router.resolve(agentTask));
        assertEquals("KB-400", ex.getCode());
    }

    private Task visibleTask(Long taskRecordId, String publicTaskId, String projectId, String kbId, Long userId,
                             String type, String typeId, TaskStatus status, String pipelineContext) {
        Instant now = Instant.now();
        return new Task(taskRecordId, publicTaskId, projectId, kbId, userId, type, status,
                null, pipelineContext, null, typeId, now, now);
    }

    private StageExecution stageTask(Long taskRecordId, Long parentTaskRecordId, String stageRunKey,
                                     String type, String typeId, TaskStatus status, String stagePayload) {
        Instant now = Instant.now();
        return new StageExecution(taskRecordId, parentTaskRecordId, stageRunKey, type, typeId,
                status, stagePayload, null, null, 1, now, null, now, now);
    }
}
