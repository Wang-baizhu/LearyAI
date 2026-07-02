// Responsibility: Verify TaskCommandAppService external entry guard and retry routing integration.
package com.notebook.learyAI.module.task.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.template.application.TemplatePluginRegistry;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.task.application.orchestration.TaskRetryRouter;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskCommandAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.contract.command.AgentPayload;
import com.notebook.learyAI.module.task.contract.command.AgentRunCommand;
import com.notebook.learyAI.module.task.contract.command.TaskAgentCommandFactory;
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
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskCommandAppServiceTest {
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private TaskMqPublisher taskMqPublisher;
    @Mock
    private TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    @Mock
    private TaskRetryRouter taskRetryRouter;
    @Mock
    private TaskAgentCommandFactory taskAgentCommandFactory;
    @Mock
    private TemplatePluginRegistry templatePluginRegistry;
    @Mock
    private AuthzSdk authzSdk;

    private static final String MINDMAP_PLUGIN_UUID = "11111111-1111-1111-1111-111111111111";
    private static final String KBVIEW_PLUGIN_UUID = "44444444-4444-4444-4444-444444444444";
    private static final String CARD_PLUGIN_UUID = "33333333-3333-3333-3333-333333333333";
    private static final String QUIZ_PLUGIN_UUID = "22222222-2222-2222-2222-222222222222";

    @Test
    @DisplayName("createTask: 外部创建 doc 应拒绝")
    void createTask_whenTypeDoc_shouldThrowKb400() {
        TaskCommandAppService appService = newAppService();
        BizException ex = assertThrows(BizException.class, () -> appService.createTask(
                "p1", "doc", "d1", TaskStatus.PROCESSING, "kb-1", Map.of(), null, "manual"
        ));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("createTask: 外部创建 template_pipeline 应编排 template agent 阶段")
    void createTask_whenTypeTemplatePipeline_shouldStartTemplatePipeline() {
        TaskCommandAppService appService = newAppService();
        Task templatePipelineTask = visibleTask(8L, "task-8", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.UPLOADING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-1\",\"pluginId\":\"mindmap\"}", null, null);
        when(taskAppService.createVisibleTask(eq("p1"), eq("kb-1"), eq(9L), eq(TaskTypes.TEMPLATE_PIPELINE), eq("_"),
                eq(TaskStatus.UPLOADING), any(), any())).thenReturn(templatePipelineTask);

        appService.createTask("p1", TaskTypes.TEMPLATE_PIPELINE, "_", TaskStatus.UPLOADING, "kb-1",
                Map.of(
                        "templateId", "tpl-1",
                        "pluginId", MINDMAP_PLUGIN_UUID,
                        "promptVars", Map.of("focus", "第二章"),
                        "docRefs", java.util.List.of(Map.of("id", "doc-1", "name", "D1"))
                ),
                null, "manual");

        verify(taskWorkflowOrchestrator).startPipeline(
                eq(templatePipelineTask),
                argThat((Map<String, Object> pipelineContext) -> pipelineContext != null
                        && MINDMAP_PLUGIN_UUID.equals(String.valueOf(pipelineContext.get("pluginId")))
                        && "template".equals(String.valueOf(pipelineContext.get("agentTaskType")))
                        && "tpl-1".equals(String.valueOf(pipelineContext.get("templateId")))
                        && Map.of("focus", "第二章").equals(pipelineContext.get("promptVars"))
                        && pipelineContext.get("docRefs") instanceof java.util.List<?>),
                eq(9L)
        );
        verify(taskWorkflowOrchestrator, never()).startPipeline(templatePipelineTask, Map.of("kbId", "kb-1"), 9L);
    }

    @Test
    @DisplayName("createTask: kbview 应走独立 agent_pipeline 编排")
    void createTask_whenTypeAgentPipelineKbview_shouldStartAgentPipeline() {
        TaskCommandAppService appService = newAppService();
        Task templatePipelineTask = visibleTask(18L, "task-18", "p1", "kb-1", 9L, TaskTypes.AGENT_PIPELINE, "_",
                TaskStatus.UPLOADING, "{\"kbId\":\"kb-1\",\"pluginId\":\"" + KBVIEW_PLUGIN_UUID + "\"}", null, null);
        when(taskAppService.createVisibleTask(eq("p1"), eq("kb-1"), eq(9L), eq(TaskTypes.AGENT_PIPELINE), eq("_"),
                eq(TaskStatus.UPLOADING), any(), any())).thenReturn(templatePipelineTask);

        appService.createTask("p1", TaskTypes.AGENT_PIPELINE, "_", TaskStatus.UPLOADING, "kb-1",
                Map.of(
                        "pluginId", KBVIEW_PLUGIN_UUID,
                        "promptVars", Map.of("focus", "关键主题"),
                        "info", "docs=2;templates=1"
                ),
                null, "manual");

        verify(taskWorkflowOrchestrator).startPipeline(
                eq(templatePipelineTask),
                argThat((Map<String, Object> pipelineContext) -> pipelineContext != null
                        && KBVIEW_PLUGIN_UUID.equals(String.valueOf(pipelineContext.get("pluginId")))
                        && "kbview".equals(String.valueOf(pipelineContext.get("agentTaskType")))
                        && Map.of("focus", "关键主题").equals(pipelineContext.get("promptVars"))
                        && "docs=2;templates=1".equals(String.valueOf(pipelineContext.get("info")))),
                eq(9L)
        );
        verify(templatePluginRegistry, never()).requirePluginById(9L, "p1", KBVIEW_PLUGIN_UUID);
    }

    @Test
    @DisplayName("createTask: pptprompt_pipeline 应使用空 scope 并启动新 pipeline")
    void createTask_whenTypePptPromptPipeline_shouldStartPipeline() {
        TaskCommandAppService appService = newAppService();
        Task pptTask = visibleTask(28L, "task-28", null,
                null, 9L, TaskTypes.PPTPROMPT_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"promptMarkdown\":\"body_1: 第一段\"}", null, null);
        when(taskAppService.createVisibleTask(
                eq(null),
                eq(null),
                eq(9L),
                eq(TaskTypes.PPTPROMPT_PIPELINE),
                eq("_"),
                eq(TaskStatus.PROCESSING), any(), any())).thenReturn(pptTask);

        appService.createTask(null, TaskTypes.PPTPROMPT_PIPELINE, "_", TaskStatus.PROCESSING, null,
                Map.of(
                        "promptMarkdown", "body_1: 第一段",
                        "pageId", "page-1",
                        "pageTitle", "封面页"
                ),
                null, "manual");

        verify(taskWorkflowOrchestrator).startPipeline(
                eq(pptTask),
                argThat((Map<String, Object> pipelineContext) -> pipelineContext != null
                        && "body_1: 第一段".equals(String.valueOf(pipelineContext.get("promptMarkdown")))
                        && "page-1".equals(String.valueOf(pipelineContext.get("pageId")))
                        && "封面页".equals(String.valueOf(pipelineContext.get("pageTitle")))),
                eq(9L)
        );
        verify(authzSdk, never()).requireProjectId(any(), anyString(), anyString(), anyString());
        verify(authzSdk, never()).requireRole(anyLong(), anyString(), anySet());
    }

    @Test
    @DisplayName("createTask: card 也应复用 template_pipeline 编排")
    void createTask_whenTypeTemplatePipelineCard_shouldStartTemplatePipeline() {
        TaskCommandAppService appService = newAppService();
        Task templatePipelineTask = visibleTask(19L, "task-19", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.UPLOADING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-3\",\"pluginId\":\"card\"}", null, null);
        when(taskAppService.createVisibleTask(eq("p1"), eq("kb-1"), eq(9L), eq(TaskTypes.TEMPLATE_PIPELINE), eq("_"),
                eq(TaskStatus.UPLOADING), any(), any())).thenReturn(templatePipelineTask);

        appService.createTask("p1", TaskTypes.TEMPLATE_PIPELINE, "_", TaskStatus.UPLOADING, "kb-1",
                Map.of(
                        "templateId", "tpl-3",
                        "pluginId", CARD_PLUGIN_UUID,
                        "promptVars", Map.of("focus", "核心概念"),
                        "docRefs", java.util.List.of(Map.of("id", "doc-1", "name", "D1"))
                ),
                null, "manual");

        verify(taskWorkflowOrchestrator).startPipeline(
                eq(templatePipelineTask),
                argThat((Map<String, Object> pipelineContext) -> pipelineContext != null
                        && CARD_PLUGIN_UUID.equals(String.valueOf(pipelineContext.get("pluginId")))
                        && "template".equals(String.valueOf(pipelineContext.get("agentTaskType")))
                        && "tpl-3".equals(String.valueOf(pipelineContext.get("templateId")))
                        && Map.of("focus", "核心概念").equals(pipelineContext.get("promptVars"))
                        && pipelineContext.get("docRefs") instanceof java.util.List<?>),
                eq(9L)
        );
    }

    @Test
    @DisplayName("createTask: template_pipeline 缺少 pluginId 应拒绝")
    void createTask_whenTemplatePipelineMissingPluginId_shouldThrowKb400() {
        TaskCommandAppService appService = newAppService();
        BizException ex = assertThrows(BizException.class, () -> appService.createTask(
                "p1", TaskTypes.TEMPLATE_PIPELINE, "_", TaskStatus.UPLOADING, "kb-1",
                Map.of("templateId", "tpl-4"), null, "manual"
        ));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("createTask: template_pipeline 不允许使用 kbview 插件创建任务")
    void createTask_whenTemplatePipelineUsesKbviewPlugin_shouldThrowKb400() {
        TaskCommandAppService appService = newAppService();

        BizException ex = assertThrows(BizException.class, () -> appService.createTask(
                "p1", TaskTypes.TEMPLATE_PIPELINE, "_", TaskStatus.UPLOADING, "kb-1",
                Map.of(
                        "templateId", "tpl-kbview",
                        "pluginId", KBVIEW_PLUGIN_UUID
                ),
                null, "manual"
        ));

        assertEquals("KB-400", ex.getCode());
        verify(templatePluginRegistry, never()).requirePluginById(9L, "p1", KBVIEW_PLUGIN_UUID);
    }

    @Test
    @DisplayName("createTask: template_pipeline 使用当前不可用插件时应拒绝")
    void createTask_whenTemplatePipelinePluginUnavailable_shouldThrowTemplate400() {
        TaskCommandAppService appService = newAppService();
        String removedPluginId = "55555555-5555-5555-5555-555555555555";
        when(templatePluginRegistry.requirePluginById(9L, "p1", removedPluginId))
                .thenThrow(new BizException("TEMPLATE-400", "pluginId invalid"));

        BizException ex = assertThrows(BizException.class, () -> appService.createTask(
                "p1", TaskTypes.TEMPLATE_PIPELINE, "_", TaskStatus.UPLOADING, "kb-1",
                Map.of(
                        "templateId", "tpl-removed",
                        "pluginId", removedPluginId
                ),
                null, "manual"
        ));

        assertEquals("TEMPLATE-400", ex.getCode());
    }

    @Test
    @DisplayName("retryTask: 命中阶段重试应更新目标阶段并发布对应命令")
    void retryTask_whenRouteToStage_shouldRetryStageTask() {
        TaskCommandAppService appService = newAppService();
        Task parentTask = visibleTask(10L, "task-10", "p1", "kb-1", 9L, TaskTypes.DOCUMENT_PIPELINE, "doc-1",
                TaskStatus.FAILED, "{\"kbId\":\"kb-1\"}", null, null);
        when(authzSdk.requireUserId()).thenReturn(9L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        when(taskAppService.findVisibleByPublicTaskId("task-10", "p1")).thenReturn(Optional.of(parentTask));
        StageExecution childStage = stageExecution(11L, 10L, TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                TaskTypes.AGENT, "doc-1", TaskStatus.FAILED, "{\"kbId\":\"kb-1\"}");
        when(taskRetryRouter.resolve(parentTask)).thenReturn(TaskRetryRouter.RetryDecision.retryStage(parentTask, childStage, true));
        when(taskAppService.readStageInput(childStage)).thenReturn(Map.of(
                "kbId", "kb-1",
                "agentTaskType", "kbsummary"
        ));
        AgentRunCommand childCommand = testAgentCommand("kbsummary");
        when(taskStatusService.retryStageExecution(eq(parentTask), eq(childStage), eq("retry")))
                .thenReturn(Optional.of(new TaskStatusService.StageStatusApplyResult(childStage)));
        when(taskAgentCommandFactory.create(eq(parentTask), eq(childStage), any(), eq(9L))).thenReturn(childCommand);

        appService.retryTask("p1", "kb-1", "task-10");

        verify(taskStatusService).updateTaskStatus(10L, "p1", TaskStatus.PROCESSING,
                null, null, "retry_stage");
        verify(taskStatusService).retryStageExecution(parentTask, childStage, "retry");
        verify(taskMqPublisher).publishAgentRunCommand(childCommand);
    }

    @Test
    @DisplayName("retryTask: 命中流程重试应重新启动 pipeline 编排")
    void retryTask_whenRouteToPipeline_shouldRestartPipeline() {
        TaskCommandAppService appService = newAppService();
        Task pipelineTask = visibleTask(20L, "task-20", "p1", "kb-2", 9L, TaskTypes.DOCUMENT_PIPELINE, "doc-2",
                TaskStatus.FAILED, "{\"kbId\":\"kb-2\"}", null, null);
        when(authzSdk.requireUserId()).thenReturn(9L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        when(taskAppService.findVisibleByPublicTaskId("task-20", "p1")).thenReturn(Optional.of(pipelineTask));
        when(taskRetryRouter.resolve(pipelineTask)).thenReturn(TaskRetryRouter.RetryDecision.retryPipeline(pipelineTask));
        when(taskAppService.readPipelineContext(pipelineTask)).thenReturn(Map.of("kbId", "kb-2"));

        appService.retryTask("p1", "kb-2", "task-20");

        verify(taskStatusService).updateTaskStatus(20L, "p1", TaskStatus.PROCESSING,
                null, null, "retry");
        verify(taskWorkflowOrchestrator).startPipeline(pipelineTask, Map.of("kbId", "kb-2"), 9L);
        verify(taskMqPublisher, never()).publishTaskCreated(eq(pipelineTask), eq(Map.of("kbId", "kb-2")));
    }

    @Test
    @DisplayName("retryTask: template_pipeline 命中流程重试应重启 template 编排")
    void retryTask_whenTemplatePipelineRouteToPipeline_shouldRestartTemplatePipeline() {
        TaskCommandAppService appService = newAppService();
        Task pipelineTask = visibleTask(21L, "task-21", "p1", "kb-2", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.FAILED, "{\"kbId\":\"kb-2\",\"templateId\":\"tpl-5\",\"pluginId\":\"22222222-2222-2222-2222-222222222222\",\"agentTaskType\":\"template\"}", null, null);
        when(taskAppService.findVisibleByPublicTaskId("task-21", "p1")).thenReturn(Optional.of(pipelineTask));
        when(taskRetryRouter.resolve(pipelineTask)).thenReturn(TaskRetryRouter.RetryDecision.retryPipeline(pipelineTask));
        when(taskAppService.readPipelineContext(pipelineTask)).thenReturn(Map.of(
                "kbId", "kb-2",
                "templateId", "tpl-5",
                "pluginId", QUIZ_PLUGIN_UUID,
                "agentTaskType", "template"
        ));

        appService.retryTask("p1", "kb-2", "task-21");

        verify(taskStatusService).updateTaskStatus(21L, "p1", TaskStatus.PROCESSING,
                null, null, "retry");
        verify(taskWorkflowOrchestrator).startPipeline(
                pipelineTask,
                Map.of("kbId", "kb-2", "templateId", "tpl-5", "pluginId", QUIZ_PLUGIN_UUID, "agentTaskType", "template"),
                9L
        );
    }

    @Test
    @DisplayName("retryTask: 请求 kbId 与任务归属不一致应返回 KB-404")
    void retryTask_whenKbIdMismatch_shouldThrowKb404() {
        TaskCommandAppService appService = newAppService();
        Task pipelineTask = visibleTask(23L, "task-23", "p1", "kb-2", 9L, TaskTypes.DOCUMENT_PIPELINE, "doc-2",
                TaskStatus.FAILED, "{\"kbId\":\"kb-2\"}", null, null);
        when(taskAppService.findVisibleByPublicTaskId("task-23", "p1")).thenReturn(Optional.of(pipelineTask));

        BizException ex = assertThrows(BizException.class, () -> appService.retryTask("p1", "kb-1", "task-23"));

        assertEquals("KB-404", ex.getCode());
        verify(taskRetryRouter, never()).resolve(any());
    }

    private TaskCommandAppService newAppService() {
        TaskCommandAppService service = new TaskCommandAppService(
                taskAppService, taskStatusService, taskMqPublisher, taskWorkflowOrchestrator, taskRetryRouter,
                taskAgentCommandFactory, templatePluginRegistry, authzSdk, new ObjectMapper()
        );
        lenient().when(authzSdk.requireUserId()).thenReturn(9L);
        lenient().when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        lenient().when(authzSdk.requireRole(eq(9L), eq("p1"), anySet()))
                .thenReturn(com.notebook.learyAI.module.authz.domain.model.ProjectRole.MEMBER);
        lenient().when(templatePluginRegistry.requirePluginById(9L, "p1", MINDMAP_PLUGIN_UUID)).thenReturn(new TemplatePluginManifest(
                MINDMAP_PLUGIN_UUID, "mindmap", null, 9L, "思维导图",
                "/templates/mindmap/index.html", "1.0.0", Map.of(), Map.of(), Map.of(), "ACTIVE"
        ));
        lenient().when(templatePluginRegistry.requirePluginById(9L, "p1", CARD_PLUGIN_UUID)).thenReturn(new TemplatePluginManifest(
                CARD_PLUGIN_UUID, "card", null, 9L, "卡片",
                "/templates/card/index.html", "1.0.0", Map.of(), Map.of(), Map.of(), "ACTIVE"
        ));
        lenient().when(templatePluginRegistry.requirePluginById(9L, "p1", QUIZ_PLUGIN_UUID)).thenReturn(new TemplatePluginManifest(
                QUIZ_PLUGIN_UUID, "quiz", null, 9L, "题目",
                "/templates/quiz/index.html", "1.0.0", Map.of(), Map.of(), Map.of(), "ACTIVE"
        ));
        return service;
    }

    private AgentRunCommand testAgentCommand(String agentTaskType) {
        return new AgentRunCommand(
                "m-1",
                "1.0",
                "2026-04-19T00:00:00Z",
                "trace-1",
                "backend",
                "p1",
                "kb-1",
                9L,
                11L,
                TaskTypes.AGENT,
                10L,
                TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                new AgentPayload("_", agentTaskType, null, Map.of(), java.util.List.of(), null, null, null)
        );
    }

    private Task visibleTask(Long taskRecordId, String publicTaskId, String projectId, String kbId, Long userId,
                             String type, String typeId, TaskStatus status, String pipelineContext,
                             String currentStage, String viewData) {
        Instant now = Instant.now();
        return new Task(taskRecordId, publicTaskId, projectId, kbId, userId, type, status,
                currentStage, pipelineContext, viewData, typeId, now, now);
    }

    private StageExecution stageExecution(Long stageExecutionId, Long taskId, String stageKey, String executorType,
                                          String executionType, TaskStatus status, String inputJson) {
        Instant now = Instant.now();
        return new StageExecution(stageExecutionId, taskId, stageKey, executorType, executionType, status,
                inputJson, null, null, 1, now, null, now, now);
    }
}
