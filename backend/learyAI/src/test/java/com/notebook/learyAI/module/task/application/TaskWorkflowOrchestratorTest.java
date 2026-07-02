// Responsibility: Verify workflow orchestrator stage transitions for document pipeline.
package com.notebook.learyAI.module.task.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.task.application.orchestration.AgentTaskStageStatusHandler;
import com.notebook.learyAI.module.task.application.orchestration.DocTaskStageStatusHandler;
import com.notebook.learyAI.module.task.application.orchestration.TaskStageExecutionCoordinator;
import com.notebook.learyAI.module.task.application.orchestration.TaskStageStatusHandlerRegistry;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.application.orchestration.TemplatePluginPublishTaskStageStatusHandler;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistries;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.contract.command.AgentPayload;
import com.notebook.learyAI.module.task.contract.command.AgentRunCommand;
import com.notebook.learyAI.module.task.contract.command.TaskAgentCommandFactory;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskWorkflowOrchestratorTest {
    private static final String QUIZ_PLUGIN_UUID = "22222222-2222-2222-2222-222222222222";
    private static final String MINDMAP_PLUGIN_UUID = "11111111-1111-1111-1111-111111111111";
    private static final String KBVIEW_PLUGIN_UUID = "44444444-4444-4444-4444-444444444444";
    private static final String CARD_PLUGIN_UUID = "33333333-3333-3333-3333-333333333333";

    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private TaskMqPublisher taskMqPublisher;
    @Mock
    private TaskAgentCommandFactory taskAgentCommandFactory;
    @Mock
    private KbDocRepository kbDocRepository;
    @Mock
    private KbDocQueryCache kbDocQueryCache;

    @Test
    @DisplayName("startPipeline: document_pipeline 应创建内部 doc 阶段并发布 doc command")
    void startPipeline_whenDocumentPipeline_shouldCreateDocStage() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task pipelineTask = visibleTask(1L, "task-1", "p1", "kb-1", 9L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}", TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY, null);
        StageExecution docStage = stageExecution(2L, 1L, TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY,
                TaskTypes.DOC, TaskTypes.DOC, TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}", null);
        when(taskAppService.findLatestStageExecutionByTaskIdAndStageKey(1L, TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY))
                .thenReturn(Optional.empty());
        when(taskAppService.createStageExecutionTask(eq("p1"), eq("kb-1"), eq(9L), eq(1L),
                eq(TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY), eq(TaskTypes.DOC), anyString(),
                eq(TaskStatus.PROCESSING), anyString(), any())).thenReturn(docStage);
        orchestrator.startPipeline(pipelineTask, Map.of("kbId", "kb-1"), 9L);

        verify(taskAppService).publishStageCommand(pipelineTask, docStage, Map.of("kbId", "kb-1"));
    }

    @Test
    @DisplayName("onStageStatusChanged: doc DONE 应更新 kbdoc 并创建 agent 阶段")
    void onStageStatusChanged_whenDocDone_shouldCreateAgentStage() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task parentTask = visibleTask(1L, "task-1", "p1", "kb-1", 9L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}", TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY, null);
        StageExecution docStageTask = stageExecution(2L, 1L, TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY,
                TaskTypes.DOC, "doc-1", TaskStatus.DONE, "{\"kbId\":\"kb-1\",\"name\":\"demo.pdf\"}", null);
        StageExecution agentStage = stageExecution(3L, 1L, TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                TaskTypes.AGENT, TaskWorkflowDefinitions.AGENT_TASK_TYPE_KB_SUMMARY, TaskStatus.PROCESSING,
                "{\"agentTaskType\":\"kbsummary\",\"docRefs\":[{\"id\":\"doc-1\",\"name\":\"doc-1\"}]}", null);
        when(taskAppService.findById(1L, "p1")).thenReturn(Optional.of(parentTask));
        when(taskAppService.findLatestStageExecutionByTaskIdAndStageKey(1L, TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY))
                .thenReturn(Optional.empty());
        when(taskAppService.readPipelineContext(parentTask)).thenReturn(Map.of("kbId", "kb-1", "docId", "doc-1"));
        when(taskAppService.createStageExecutionTask(eq("p1"), eq("kb-1"), eq(9L), eq(1L),
                eq(TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY), eq(TaskTypes.AGENT), anyString(),
                eq(TaskStatus.PROCESSING), anyString(), any()))
                .thenReturn(agentStage);
        AgentRunCommand summaryCommand = testAgentCommand("kbsummary");
        when(taskAgentCommandFactory.create(eq(parentTask), eq(agentStage), any(), eq(9L))).thenReturn(summaryCommand);

        orchestrator.onStageStatusChanged(docStageTask, "p1", TaskStatus.DONE, Map.of("parsed", true),
                "done", "kb-1", 9L, "status_change");

        verify(kbDocRepository).updateStatusByDocId("p1", "doc-1", "DONE");
        verify(kbDocQueryCache).evictDocByDocId("p1", "doc-1");
        verify(taskMqPublisher).publishAgentRunCommand(summaryCommand);
    }

    @Test
    @DisplayName("startPipeline: template_pipeline 应创建内部 agent 阶段并发布 agent command")
    void startPipeline_whenTemplatePipeline_shouldCreateAgentStage() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task pipelineTask = visibleTask(10L, "task-10", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-1\",\"pluginId\":\"" + QUIZ_PLUGIN_UUID + "\"}",
                "agent:template:" + QUIZ_PLUGIN_UUID, null);
        StageExecution agentStage = stageExecution(11L, 10L, "agent:template:" + QUIZ_PLUGIN_UUID,
                TaskTypes.AGENT, "template", TaskStatus.PROCESSING,
                "{\"agentTaskType\":\"template\",\"docRefs\":[{\"id\":\"doc-1\",\"name\":\"D1\"}],\"promptVars\":{\"difficulty\":\"高\"}}",
                null);
        when(taskAppService.findLatestStageExecutionByTaskIdAndStageKey(10L, "agent:template:" + QUIZ_PLUGIN_UUID))
                .thenReturn(Optional.empty());
        when(taskAppService.createStageExecutionTask(eq("p1"), eq("kb-1"), eq(9L), eq(10L),
                eq("agent:template:" + QUIZ_PLUGIN_UUID), eq(TaskTypes.AGENT), anyString(),
                eq(TaskStatus.PROCESSING), anyString(), any())).thenReturn(agentStage);
        AgentRunCommand templateCommand = testAgentCommand("template");
        when(taskAgentCommandFactory.create(eq(pipelineTask), eq(agentStage), any(), eq(9L))).thenReturn(templateCommand);

        orchestrator.startPipeline(
                pipelineTask,
                Map.of(
                        "kbId", "kb-1",
                        "templateId", "tpl-1",
                        "pluginId", QUIZ_PLUGIN_UUID,
                        "agentTaskType", "template",
                        "promptVars", Map.of("difficulty", "高"),
                        "docRefs", java.util.List.of(Map.of("id", "doc-1", "name", "D1"))
                ),
                9L
        );

        verify(taskMqPublisher).publishAgentRunCommand(templateCommand);
    }

    @Test
    @DisplayName("onStageStatusChanged: template agent PROCESSING 应同步父任务为 PROCESSING 并写入进度文案")
    void onStageStatusChanged_whenTemplateAgentProcessing_shouldMarkParentProcessing() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task parentTask = visibleTask(20L, "task-20", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.UPLOADING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-2\",\"pluginId\":\"" + MINDMAP_PLUGIN_UUID + "\"}",
                "agent:template:" + MINDMAP_PLUGIN_UUID, null);
        StageExecution templateAgentStage = stageExecution(21L, 20L, "agent:template:" + MINDMAP_PLUGIN_UUID,
                TaskTypes.AGENT, "_", TaskStatus.PROCESSING,
                "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-2\",\"pluginId\":\"" + MINDMAP_PLUGIN_UUID + "\"}", null);
        when(taskAppService.findById(20L, "p1")).thenReturn(Optional.of(parentTask));
        when(taskAppService.readPipelineContext(parentTask)).thenReturn(Map.of(
                "kbId", "kb-1",
                "templateId", "tpl-2",
                "pluginId", MINDMAP_PLUGIN_UUID,
                "agentTaskType", "template"
        ));

        orchestrator.onStageStatusChanged(templateAgentStage, "p1", TaskStatus.PROCESSING, null,
                null, "kb-1", 9L, "status_change");

        verify(taskStatusService).updateTaskStatus(20L, "p1", TaskStatus.PROCESSING,
                Map.of(
                        "stage", Map.of("type", "agent", "runKey", "agent:template:" + MINDMAP_PLUGIN_UUID, "status", "PROCESSING"),
                        "info", "模板生成中...",
                        "progressText", "模板生成中..."
                ), null, "status_change");
    }

    @Test
    @DisplayName("onStageStatusChanged: template agent DONE 应按白名单写父任务 viewData patch")
    void onStageStatusChanged_whenTemplateAgentDone_shouldWriteWhitelistedViewDataPatch() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task parentTask = visibleTask(40L, "task-40", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-3\",\"pluginId\":\"" + QUIZ_PLUGIN_UUID + "\",\"docRefs\":[{\"id\":\"doc-1\",\"name\":\"D1\"}]}",
                "agent:template:" + QUIZ_PLUGIN_UUID, null);
        StageExecution templateAgentStage = stageExecution(41L, 40L, "agent:template:" + QUIZ_PLUGIN_UUID,
                TaskTypes.AGENT, "_", TaskStatus.DONE, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-3\",\"pluginId\":\"" + QUIZ_PLUGIN_UUID + "\"}", null);
        when(taskAppService.findById(40L, "p1")).thenReturn(Optional.of(parentTask));
        when(taskAppService.readPipelineContext(parentTask)).thenReturn(Map.of(
                "kbId", "kb-1",
                "templateId", "tpl-3",
                "pluginId", QUIZ_PLUGIN_UUID,
                "agentTaskType", "template",
                "docRefs", java.util.List.of(Map.of("id", "doc-1", "name", "D1"))
        ));

        orchestrator.onStageStatusChanged(templateAgentStage, "p1", TaskStatus.DONE, Map.of(
                        "outputText", "题目摘要",
                        "tokenUsage", Map.of("output", 12)
                ),
                null, "kb-1", 9L, "status_change");

        verify(taskStatusService).updateTaskStatus(40L, "p1", TaskStatus.DONE,
                Map.of(
                        "stage", Map.of("type", "agent", "runKey", "agent:template:" + QUIZ_PLUGIN_UUID, "status", "DONE"),
                        "info", "模板生成完成",
                        "summary", "题目摘要",
                        "output", Map.of("type", "template")
                ), null, "status_change");
    }

    @Test
    @DisplayName("onStageStatusChanged: kbview agent_pipeline DONE 仅按关系图结果收敛父任务展示")
    void onStageStatusChanged_whenKbviewDone_shouldWriteSummaryOnly() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task parentTask = visibleTask(42L, "task-42", "p1", "kb-1", 9L, TaskTypes.AGENT_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\",\"pluginId\":\"" + KBVIEW_PLUGIN_UUID + "\"}",
                "agent:kbview", null);
        StageExecution templateAgentStage = stageExecution(43L, 42L, "agent:kbview",
                TaskTypes.AGENT, "_", TaskStatus.DONE, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-4\",\"pluginId\":\"" + KBVIEW_PLUGIN_UUID + "\"}", null);
        when(taskAppService.findById(42L, "p1")).thenReturn(Optional.of(parentTask));
        when(taskAppService.readPipelineContext(parentTask)).thenReturn(Map.of(
                "kbId", "kb-1",
                "pluginId", KBVIEW_PLUGIN_UUID,
                "agentTaskType", "kbview"
        ));

        orchestrator.onStageStatusChanged(templateAgentStage, "p1", TaskStatus.DONE, Map.of(
                        "outputText", "关系图已更新"
                ),
                null, "kb-1", 9L, "status_change");

        verify(taskStatusService).updateTaskStatus(42L, "p1", TaskStatus.DONE,
                Map.of(
                        "stage", Map.of("type", "agent", "runKey", "agent:kbview", "status", "DONE"),
                        "info", "关系图生成完成",
                        "summary", "关系图已更新",
                        "output", Map.of("type", "kbview")
                ), null, "status_change");
    }

    @Test
    @DisplayName("onStageStatusChanged: card DONE 应按卡片类型收敛父任务展示")
    void onStageStatusChanged_whenCardDone_shouldWriteCardOutputType() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task parentTask = visibleTask(44L, "task-44", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-5\",\"pluginId\":\"" + CARD_PLUGIN_UUID + "\"}",
                "agent:template:" + CARD_PLUGIN_UUID, null);
        StageExecution templateAgentStage = stageExecution(45L, 44L, "agent:template:" + CARD_PLUGIN_UUID,
                TaskTypes.AGENT, "_", TaskStatus.DONE, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-5\",\"pluginId\":\"" + CARD_PLUGIN_UUID + "\"}", null);
        when(taskAppService.findById(44L, "p1")).thenReturn(Optional.of(parentTask));
        when(taskAppService.readPipelineContext(parentTask)).thenReturn(Map.of(
                "kbId", "kb-1",
                "templateId", "tpl-5",
                "pluginId", CARD_PLUGIN_UUID,
                "agentTaskType", "template"
        ));

        orchestrator.onStageStatusChanged(templateAgentStage, "p1", TaskStatus.DONE, Map.of(
                        "outputText", "卡片已生成"
                ),
                null, "kb-1", 9L, "status_change");

        verify(taskStatusService).updateTaskStatus(44L, "p1", TaskStatus.DONE,
                Map.of(
                        "stage", Map.of("type", "agent", "runKey", "agent:template:" + CARD_PLUGIN_UUID, "status", "DONE"),
                        "info", "模板生成完成",
                        "summary", "卡片已生成",
                        "output", Map.of("type", "template")
                ), null, "status_change");
    }

    @Test
    @DisplayName("onStageStatusChanged: document summary DONE 应写入 summary")
    void onStageStatusChanged_whenDocumentSummaryDone_shouldWriteSummary() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task parentTask = visibleTask(60L, "task-60", "p1", "kb-1", 9L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-9", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}",
                TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY, null);
        StageExecution stageTask = stageExecution(61L, 60L, TaskWorkflowDefinitions.AGENT_SUMMARY_STAGE_RUN_KEY,
                TaskTypes.AGENT, "doc-9", TaskStatus.DONE, "{\"kbId\":\"kb-1\"}", null);
        when(taskAppService.findById(60L, "p1")).thenReturn(Optional.of(parentTask));

        orchestrator.onStageStatusChanged(stageTask, "p1", TaskStatus.DONE, Map.of("outputText", "文档摘要"),
                null, "kb-1", 9L, "status_change");

        verify(taskStatusService).updateTaskStatus(60L, "p1", TaskStatus.DONE,
                Map.of(
                        "stage", Map.of("type", "agent", "runKey", "agent:summary", "status", "DONE"),
                        "summary", "文档摘要",
                        "output", Map.of("type", "summary")
                ), null, "status_change");
    }

    @Test
    @DisplayName("onStageStatusChanged: doc FAILED 应只写失败展示字段")
    void onStageStatusChanged_whenDocFailed_shouldWriteFailedPatchOnly() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task parentTask = visibleTask(50L, "task-50", "p1", "kb-1", 9L, TaskTypes.DOCUMENT_PIPELINE,
                "doc-1", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\"}", TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY, null);
        StageExecution docStageTask = stageExecution(51L, 50L, TaskWorkflowDefinitions.DOC_STAGE_RUN_KEY,
                TaskTypes.DOC, "doc-1", TaskStatus.FAILED, "{\"kbId\":\"kb-1\"}", null);
        when(taskAppService.findById(50L, "p1")).thenReturn(Optional.of(parentTask));

        orchestrator.onStageStatusChanged(docStageTask, "p1", TaskStatus.FAILED, Map.of("raw", "ignored"),
                "文档处理失败", "kb-1", 9L, "status_change");

        verify(taskStatusService).updateTaskStatus(50L, "p1", TaskStatus.FAILED,
                Map.of(
                        "stage", Map.of("type", "doc", "runKey", "doc:main", "status", "FAILED"),
                        "info", "文档处理失败",
                        "failedReason", "文档处理失败"
                ), "文档处理失败", "status_change");
    }

    @Test
    @DisplayName("startPipeline: 唯一键冲突命中已有阶段时不应重复发布 command")
    void startPipeline_whenStageAlreadyCreatedConcurrently_shouldSkipPublish() {
        TaskWorkflowOrchestrator orchestrator = newOrchestrator();
        Task pipelineTask = visibleTask(30L, "task-30", "p1", "kb-1", 9L, TaskTypes.TEMPLATE_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-6\",\"pluginId\":\"" + QUIZ_PLUGIN_UUID + "\"}",
                "agent:template:" + QUIZ_PLUGIN_UUID, null);
        StageExecution existingStage = stageExecution(31L, 30L, "agent:template:" + QUIZ_PLUGIN_UUID,
                TaskTypes.AGENT, "template", TaskStatus.PROCESSING, "{\"kbId\":\"kb-1\",\"templateId\":\"tpl-6\",\"pluginId\":\"" + QUIZ_PLUGIN_UUID + "\"}", null);
        when(taskAppService.findLatestStageExecutionByTaskIdAndStageKey(30L, "agent:template:" + QUIZ_PLUGIN_UUID))
                .thenReturn(Optional.empty(), Optional.of(existingStage));
        when(taskAppService.createStageExecutionTask(eq("p1"), eq("kb-1"), eq(9L), eq(30L),
                eq("agent:template:" + QUIZ_PLUGIN_UUID), eq(TaskTypes.AGENT), anyString(),
                eq(TaskStatus.PROCESSING), anyString(), any()))
                .thenThrow(new DataIntegrityViolationException("duplicate"));

        orchestrator.startPipeline(
                pipelineTask,
                Map.of("kbId", "kb-1", "templateId", "_", "pluginId", QUIZ_PLUGIN_UUID, "agentTaskType", "template"),
                9L
        );

        verify(taskMqPublisher, never()).publishAgentRunCommand(any());
    }

    private TaskWorkflowOrchestrator newOrchestrator() {
        TaskStageExecutionCoordinator coordinator = new TaskStageExecutionCoordinator(
                taskAppService, taskStatusService, taskMqPublisher, taskAgentCommandFactory, new ObjectMapper()
        );
        TaskStageStatusHandlerRegistry handlerRegistry = new TaskStageStatusHandlerRegistry(java.util.List.of(
                new DocTaskStageStatusHandler(taskAppService, taskStatusService, coordinator, kbDocRepository, kbDocQueryCache),
                new AgentTaskStageStatusHandler(taskAppService, taskStatusService, TaskPipelineRegistries.defaultRegistry()),
                new TemplatePluginPublishTaskStageStatusHandler(taskAppService, taskStatusService)
        ));
        return new TaskWorkflowOrchestrator(
                taskAppService,
                TaskPipelineRegistries.defaultRegistry(),
                coordinator,
                handlerRegistry
        );
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
        String resolvedPipelineContext = pipelineContext;
        if (TaskTypes.DOCUMENT_PIPELINE.equals(type)
                && (resolvedPipelineContext == null || !resolvedPipelineContext.contains("\"docId\""))
                && typeId != null && !typeId.isBlank()) {
            resolvedPipelineContext = "{\"kbId\":\"" + kbId + "\",\"docId\":\"" + typeId + "\"}";
        }
        return new Task(taskRecordId, publicTaskId, projectId, kbId, userId, type, status,
                currentStage, resolvedPipelineContext, viewData, typeId, now, now);
    }

    private StageExecution stageExecution(Long id, Long taskId, String stageKey, String executorType,
                                          String executionType, TaskStatus status, String inputJson, String outputJson) {
        Instant now = Instant.now();
        return new StageExecution(id, taskId, stageKey, executorType, executionType, status,
                inputJson, outputJson, null, 1, now, null, now, now);
    }
}
