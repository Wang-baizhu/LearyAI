// Responsibility: Verify failed-task retry flow with real task repository and status transitions.
package com.notebook.learyAI.module.task.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.template.application.TemplatePluginRegistry;
import com.notebook.learyAI.module.task.application.orchestration.TaskRetryRouter;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.application.push.TenantPushRegistry;
import com.notebook.learyAI.module.task.application.push.dto.TaskPushEvent;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskCommandAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.status.TaskStatusListener;
import com.notebook.learyAI.module.task.contract.command.AgentRunCommand;
import com.notebook.learyAI.module.task.contract.command.TaskAgentCommandFactory;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.domain.repository.StageExecutionRepository;
import com.notebook.learyAI.module.task.domain.repository.TaskRepository;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@Transactional
class TaskRetryFlowIntegrationTest extends AbstractPgRedisIntegrationTest {
    @Autowired
    private TaskRepository taskRepository;
    @Autowired
    private StageExecutionRepository stageExecutionRepository;
    @Autowired
    private ObjectMapper objectMapper;

    private TaskAppService taskAppService;
    private TaskStatusService taskStatusService;
    private TaskCommandAppService taskCommandAppService;
    private RecordingTaskMqPublisher recordingPublisher;
    private RecordingTaskStatusListener recordingStatusListener;
    private TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    private TaskAgentCommandFactory taskAgentCommandFactory;
    private String projectId;
    private static final Long USER_ID = 9001L;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID().toString();
        recordingPublisher = new RecordingTaskMqPublisher();
        recordingStatusListener = new RecordingTaskStatusListener();

        taskAppService = new TaskAppService(taskRepository, stageExecutionRepository, recordingPublisher, objectMapper);
        taskStatusService = new TaskStatusService(
                taskRepository, stageExecutionRepository, mock(TenantPushRegistry.class), List.of(recordingStatusListener), objectMapper
        );
        TaskRetryRouter taskRetryRouter = new TaskRetryRouter(taskAppService);
        taskAgentCommandFactory = new TaskAgentCommandFactory();

        AuthzSdk authzSdk = mock(AuthzSdk.class);
        TemplatePluginRegistry templatePluginRegistry = mock(TemplatePluginRegistry.class);
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(eq(projectId), anyString(), anyString(), anyString())).thenReturn(projectId);
        when(authzSdk.requireRole(eq(USER_ID), eq(projectId), anySet())).thenReturn(ProjectRole.MEMBER);

        taskWorkflowOrchestrator = mock(TaskWorkflowOrchestrator.class);
        taskCommandAppService = new TaskCommandAppService(
                taskAppService, taskStatusService, recordingPublisher, taskWorkflowOrchestrator,
                taskRetryRouter, taskAgentCommandFactory, templatePluginRegistry, authzSdk, objectMapper
        );
    }

    @Test
    @DisplayName("retryTask: 父流程存在失败子阶段时应重试子阶段并标记父流程处理中")
    void retryTask_whenParentHasFailedChild_shouldRetryChildStage() {
        Task parent = taskAppService.createVisibleTask(
                projectId, "kb-1", USER_ID, TaskTypes.DOCUMENT_PIPELINE, "doc-retry-stage",
                TaskStatus.FAILED, "{\"kbId\":\"kb-1\"}", Instant.now()
        );
        StageExecution child = taskAppService.createStageExecutionTask(
                projectId, "kb-1", USER_ID, parent.getTaskRecordId(), TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                TaskTypes.AGENT, "doc-retry-stage", TaskStatus.FAILED,
                "{\"kbId\":\"kb-1\",\"agentTaskType\":\"kbsummary\"}", Instant.now()
        );

        taskCommandAppService.retryTask(projectId, "kb-1", parent.getPublicTaskId());

        Task parentAfter = taskAppService.findById(parent.getTaskRecordId(), projectId).orElseThrow();
        StageExecution childAfter = taskAppService.findStageExecutionById(child.getId()).orElseThrow();
        assertEquals(TaskStatus.PROCESSING, parentAfter.getStatus());
        assertEquals(TaskStatus.PROCESSING, childAfter.getStatus());
        assertEquals(2, childAfter.getAttemptNo());
        assertEquals(1, recordingPublisher.agentCommands.size());
        assertEquals(child.getId(), recordingPublisher.agentCommands.get(0).taskRecordId());
        assertEquals(
                "kb-1",
                ((AgentRunCommand) recordingPublisher.agentCommands.get(0).metadata().get("command")).kbId()
        );

        assertTrue(recordingStatusListener.hasChange(parent.getTaskRecordId(), "retry_stage"));
    }

    @Test
    @DisplayName("retryTask: 无失败子阶段时应重启 pipeline 编排")
    void retryTask_whenNoFailedChild_shouldRestartPipeline() {
        Task pipeline = taskAppService.createVisibleTask(
                projectId, "kb-2", USER_ID, TaskTypes.DOCUMENT_PIPELINE, "doc-retry-pipeline",
                TaskStatus.FAILED, "{\"kbId\":\"kb-2\"}", Instant.now()
        );

        taskCommandAppService.retryTask(projectId, "kb-2", pipeline.getPublicTaskId());

        Task pipelineAfter = taskAppService.findById(pipeline.getTaskRecordId(), projectId).orElseThrow();
        assertEquals(TaskStatus.PROCESSING, pipelineAfter.getStatus());
        verify(taskWorkflowOrchestrator).startPipeline(
                org.mockito.ArgumentMatchers.argThat(task -> task != null
                        && pipeline.getTaskRecordId().equals(task.getTaskRecordId())),
                eq(Map.of("kbId", "kb-2")),
                eq(USER_ID)
        );
    }

    @Test
    @DisplayName("retryTask: template_pipeline 无失败子阶段时应重启 template pipeline")
    void retryTask_whenTemplatePipelineWithoutFailedChild_shouldRestartTemplatePipeline() {
        Task pipeline = taskAppService.createVisibleTask(
                projectId, "kb-2", USER_ID, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.FAILED, "{\"kbId\":\"kb-2\",\"templateId\":\"tpl-r1\",\"pluginId\":\"mindmap\"}", Instant.now()
        );

        taskCommandAppService.retryTask(projectId, "kb-2", pipeline.getPublicTaskId());

        Task pipelineAfter = taskAppService.findById(pipeline.getTaskRecordId(), projectId).orElseThrow();
        assertEquals(TaskStatus.PROCESSING, pipelineAfter.getStatus());
        verify(taskWorkflowOrchestrator).startPipeline(
                org.mockito.ArgumentMatchers.argThat(task -> task != null
                        && pipeline.getTaskRecordId().equals(task.getTaskRecordId())),
                eq(Map.of("kbId", "kb-2", "templateId", "tpl-r1", "pluginId", "mindmap")),
                eq(USER_ID)
        );
    }

    @Test
    @DisplayName("retryTask: doc 已完成且摘要阶段缺失时应从 doc DONE 恢复后续编排")
    void retryTask_whenDocDoneAndSummaryMissing_shouldResumeFromDocDone() {
        Task pipeline = taskAppService.createVisibleTask(
                projectId, "kb-4", USER_ID, TaskTypes.DOCUMENT_PIPELINE, "doc-resume",
                TaskStatus.FAILED, "{\"kbId\":\"kb-4\"}", Instant.now()
        );
        StageExecution docStage = taskAppService.createStageExecutionTask(
                projectId, "kb-4", USER_ID, pipeline.getTaskRecordId(), TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY,
                TaskTypes.DOC, "doc-resume", TaskStatus.DONE, "{\"kbId\":\"kb-4\"}", Instant.now()
        );

        taskCommandAppService.retryTask(projectId, "kb-4", pipeline.getPublicTaskId());

        Task pipelineAfter = taskAppService.findById(pipeline.getTaskRecordId(), projectId).orElseThrow();
        assertEquals(TaskStatus.PROCESSING, pipelineAfter.getStatus());
        verify(taskWorkflowOrchestrator).onStageStatusChanged(
                org.mockito.ArgumentMatchers.argThat((StageExecution task) -> task != null
                        && docStage.getId().equals(task.getId())),
                eq(projectId),
                eq(TaskStatus.DONE),
                eq(Map.of()),
                eq(null),
                eq("kb-4"),
                eq(USER_ID),
                eq("retry_resume")
        );
        assertEquals(0, recordingPublisher.taskCreatedCommands.size());
        assertEquals(0, recordingPublisher.agentCommands.size());
    }

    @Test
    @DisplayName("retryTask: template 阶段已 DONE 时应跳过重跑并用 DONE 结果收敛父任务")
    void retryTask_whenTemplateStageDone_shouldSkipReRunAndReconcileParent() {
        String pluginId = "22222222-2222-2222-2222-222222222222";
        Task pipeline = taskAppService.createVisibleTask(
                projectId, "kb-5", USER_ID, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.FAILED, "{\"kbId\":\"kb-5\",\"templateId\":\"tpl-r2\",\"pluginId\":\"" + pluginId + "\"}", Instant.now()
        );
        StageExecution agentStage = taskAppService.createStageExecutionTask(
                projectId, "kb-5", USER_ID, pipeline.getTaskRecordId(), "agent:template:" + pluginId,
                TaskTypes.AGENT, "_", TaskStatus.DONE, "{\"kbId\":\"kb-5\",\"templateId\":\"tpl-r2\",\"pluginId\":\"" + pluginId + "\"}", Instant.now()
        );

        taskCommandAppService.retryTask(projectId, "kb-5", pipeline.getPublicTaskId());

        Task pipelineAfter = taskAppService.findById(pipeline.getTaskRecordId(), projectId).orElseThrow();
        assertEquals(TaskStatus.PROCESSING, pipelineAfter.getStatus());
        verify(taskWorkflowOrchestrator).onStageStatusChanged(
                org.mockito.ArgumentMatchers.argThat((StageExecution task) -> task != null
                        && agentStage.getId().equals(task.getId())),
                eq(projectId),
                eq(TaskStatus.DONE),
                eq(Map.of()),
                eq(null),
                eq("kb-5"),
                eq(USER_ID),
                eq("retry_resume")
        );
        assertEquals(0, recordingPublisher.taskCreatedCommands.size());
        assertEquals(0, recordingPublisher.agentCommands.size());
    }

    @Test
    @DisplayName("retryTask: template_plugin_publish 阶段失败时应重新下发阶段命令")
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void retryTask_whenTemplatePluginPublishStageFailed_shouldRepublishStageCommand() throws Exception {
        Task pipeline = taskAppService.createVisibleTask(
                projectId, "template-plugin-publish", USER_ID, TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE, "_",
                TaskStatus.FAILED,
                "{\"pluginId\":\"plugin-1\",\"objectKey\":\"template-plugins-staging/plugin-1/dist.zip\"}",
                Instant.now()
        );
        StageExecution publishStage = taskAppService.createStageExecutionTask(
                projectId, "template-plugin-publish", USER_ID, pipeline.getTaskRecordId(),
                TaskWorkflowDefinitions.TEMPLATE_PLUGIN_PUBLISH_STAGE_RUN_KEY,
                TaskTypes.TEMPLATE_PLUGIN_PUBLISH, TaskTypes.TEMPLATE_PLUGIN_PUBLISH, TaskStatus.FAILED,
                "{\"pluginId\":\"plugin-1\",\"objectKey\":\"template-plugins-staging/plugin-1/dist.zip\"}",
                Instant.now()
        );

        taskCommandAppService.retryTask(projectId, "template-plugin-publish", pipeline.getPublicTaskId());

        Task pipelineAfter = taskAppService.findById(pipeline.getTaskRecordId(), projectId).orElseThrow();
        StageExecution publishStageAfter = taskAppService.findStageExecutionById(publishStage.getId()).orElseThrow();
        assertEquals(TaskStatus.PROCESSING, pipelineAfter.getStatus());
        assertEquals(TaskStatus.PROCESSING, publishStageAfter.getStatus());
        assertEquals(2, publishStageAfter.getAttemptNo());
        assertEquals(1, recordingPublisher.taskCreatedCommands.size());
        assertEquals(publishStage.getId(), recordingPublisher.taskCreatedCommands.get(0).taskRecordId());
        assertEquals(
                "template-plugins-staging/plugin-1/dist.zip",
                recordingPublisher.taskCreatedCommands.get(0).metadata().get("objectKey")
        );
        verifyNoInteractions(taskWorkflowOrchestrator);
    }

    @Test
    @DisplayName("updateTaskStatus: FAILED 回到 PROCESSING 仅允许 retry* 变更类型")
    void updateTaskStatus_whenFromFailedToProcessing_shouldRequireRetryChangeType() {
        Task failedTask = taskAppService.createVisibleTask(
                projectId, "kb-3", USER_ID, TaskTypes.AGENT, "doc-status-guard",
                TaskStatus.FAILED, "{\"kbId\":\"kb-3\"}", Instant.now()
        );

        Optional<TaskPushEvent> blocked = taskStatusService.updateTaskStatus(
                failedTask.getTaskRecordId(), projectId, TaskStatus.PROCESSING, null, null, "status_change"
        );
        assertTrue(blocked.isEmpty());
        Task stillFailed = taskAppService.findById(failedTask.getTaskRecordId(), projectId).orElseThrow();
        assertEquals(TaskStatus.FAILED, stillFailed.getStatus());

        Optional<TaskPushEvent> retried = taskStatusService.updateTaskStatus(
                failedTask.getTaskRecordId(), projectId, TaskStatus.PROCESSING, null, null, "retry"
        );
        assertTrue(retried.isPresent());
        Task processing = taskAppService.findById(failedTask.getTaskRecordId(), projectId).orElseThrow();
        assertEquals(TaskStatus.PROCESSING, processing.getStatus());
    }

    private static final class RecordingTaskMqPublisher implements TaskMqPublisher {
        private final List<PublishRecord> taskCreatedCommands = new ArrayList<>();
        private final List<PublishRecord> agentCommands = new ArrayList<>();

        @Override
        public void publishTaskCreated(Task task, Map<String, Object> metadata) {
            taskCreatedCommands.add(new PublishRecord(task.getTaskRecordId(), metadata));
        }

        @Override
        public void publishStageCommand(Task task, StageExecution stageExecution, Map<String, Object> metadata) {
            taskCreatedCommands.add(new PublishRecord(stageExecution.getTaskRecordId(), metadata));
        }

        @Override
        public void publishAgentRunCommand(Object command) {
            agentCommands.add(new PublishRecord(resolveTaskId(command), Map.of("command", command)));
        }

        private Long resolveTaskId(Object command) {
            if (command instanceof AgentRunCommand agent) {
                return agent.taskRecordId();
            }
            return null;
        }
    }

    private static final class RecordingTaskStatusListener implements TaskStatusListener {
        private final List<StatusRecord> records = new ArrayList<>();

        @Override
        public void onStatusChanged(Task task, TaskStatus prevStatus, String changeType) {
            records.add(new StatusRecord(task.getTaskRecordId(), prevStatus, task.getStatus(), changeType));
        }

        private boolean hasChange(Long taskId, String changeType) {
            return records.stream()
                    .anyMatch(record -> taskId.equals(record.taskRecordId()) && changeType.equals(record.changeType()));
        }
    }

    private record PublishRecord(Long taskRecordId, Map<String, Object> metadata) {
    }

    private record StatusRecord(Long taskRecordId, TaskStatus prevStatus, TaskStatus currentStatus, String changeType) {
    }
}
