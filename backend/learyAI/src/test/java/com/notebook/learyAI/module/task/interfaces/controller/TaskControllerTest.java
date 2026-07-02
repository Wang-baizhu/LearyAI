// Responsibility: Verify TaskController request validation, parsing and response mapping.
package com.notebook.learyAI.module.task.interfaces.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.task.application.service.TaskCommandAppService;
import com.notebook.learyAI.module.task.application.service.TaskQueryAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.interfaces.dto.TaskCreateRequest;
import com.notebook.learyAI.module.task.interfaces.dto.TaskListResponse;
import com.notebook.learyAI.module.task.interfaces.dto.TaskRetryRequest;
import com.notebook.learyAI.module.task.interfaces.dto.TaskStatusUpdateRequest;
import com.notebook.learyAI.shared.api.ApiResponse;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskControllerTest {
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private AuthzSdk authzSdk;
    @Mock
    private TaskCommandAppService taskCommandAppService;
    @Mock
    private TaskQueryAppService taskQueryAppService;

    private TaskController controller;

    @BeforeEach
    void setUp() {
        controller = new TaskController(taskStatusService, authzSdk, taskCommandAppService, taskQueryAppService,
                new ObjectMapper());
    }

    @Test
    @DisplayName("create: request 为空应返回 KB-400")
    void create_whenRequestNull_shouldThrowKb400() {
        BizException ex = assertThrows(BizException.class, () -> controller.create(null));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("create: 有效请求应创建任务并映射详情响应")
    void create_whenValid_shouldReturnDetailResponse() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        request.setType(TaskTypes.DOCUMENT_PIPELINE);
        request.setTypeId("d1");
        request.setStatus("done");
        request.setPipelineContext(Map.of("k", "v"));
        request.setInfo("ok");
        request.setChangeType("manual");

        Instant now = Instant.now();
        Task task = visibleTask(1L, "task-1", "p1", null, 2L, TaskTypes.DOCUMENT_PIPELINE, "d1",
                TaskStatus.DONE, "{\"info\":\"ok\"}", null, null, null, "{\"info\":\"ok\"}", now);
        when(taskCommandAppService.createTask("p1", TaskTypes.DOCUMENT_PIPELINE, "d1", TaskStatus.DONE,
                "kb-1", Map.of("k", "v"), "ok", "manual")).thenReturn(task);

        ApiResponse<?> response = controller.create(request);

        assertEquals("OK", response.getCode());
        com.notebook.learyAI.module.task.interfaces.dto.TaskDetailResponse data =
                (com.notebook.learyAI.module.task.interfaces.dto.TaskDetailResponse) response.getData();
        assertEquals("task-1", data.getTaskId());
        assertEquals("DONE", data.getStatus());
        assertEquals(Map.of("info", "ok"), data.getViewData());
    }

    @Test
    @DisplayName("create: 外部创建 agent 任务应返回 KB-400")
    void create_whenTypeAgent_shouldThrowKb400() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        request.setType(TaskTypes.AGENT);
        request.setTypeId("_");
        request.setStatus("done");

        BizException ex = assertThrows(BizException.class, () -> controller.create(request));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("create: 外部创建 search pipeline 应返回 KB-400")
    void create_whenTypeSearchPipeline_shouldThrowKb400() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        request.setType(TaskTypes.SEARCH_PIPELINE);
        request.setTypeId("_");
        request.setStatus("done");

        BizException ex = assertThrows(BizException.class, () -> controller.create(request));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("create: 外部创建 template_plugin_publish_pipeline 应返回 KB-400")
    void create_whenTypeTemplatePluginPublishPipeline_shouldThrowKb400() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setProjectId("p1");
        request.setKbId("template-plugin-publish");
        request.setType(TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE);
        request.setTypeId("_");
        request.setStatus("done");

        BizException ex = assertThrows(BizException.class, () -> controller.create(request));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("create: 外部创建 agent_pipeline 应允许")
    void create_whenTypeAgentPipeline_shouldAllow() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        request.setType(TaskTypes.AGENT_PIPELINE);
        request.setTypeId("_");
        request.setStatus("done");
        request.setPipelineContext(Map.of("pluginId", TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID));

        Instant now = Instant.now();
        Task task = visibleTask(2L, "task-2", "p1", null, 2L, TaskTypes.AGENT_PIPELINE, "_",
                TaskStatus.DONE, "{\"pluginId\":\"" + TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID + "\"}",
                "agent:kbview", null, null, "{\"pluginId\":\"" + TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID + "\"}", now);
        when(taskCommandAppService.createTask("p1", TaskTypes.AGENT_PIPELINE, "_", TaskStatus.DONE,
                "kb-1", Map.of("pluginId", TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID), null, null)).thenReturn(task);

        ApiResponse<?> response = controller.create(request);

        assertEquals("OK", response.getCode());
    }

    @Test
    @DisplayName("create: 外部创建 pptprompt_pipeline 不要求 projectId 和 kbId")
    void create_whenTypePptPromptPipeline_shouldAllow() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setType(TaskTypes.PPTPROMPT_PIPELINE);
        request.setTypeId("_");
        request.setStatus("processing");
        request.setPipelineContext(Map.of("promptMarkdown", "body_1: 第一段"));

        Instant now = Instant.now();
        Task task = visibleTask(3L, "task-3", null,
                null, 2L, TaskTypes.PPTPROMPT_PIPELINE, "_",
                TaskStatus.PROCESSING, "{\"promptMarkdown\":\"body_1: 第一段\"}",
                TaskWorkflowDefinitions.AGENT_PPTPROMPT_STAGE_RUN_KEY, null, null, "{\"promptMarkdown\":\"body_1: 第一段\"}", now);
        when(taskCommandAppService.createTask(null, TaskTypes.PPTPROMPT_PIPELINE, "_", TaskStatus.PROCESSING,
                null, Map.of("promptMarkdown", "body_1: 第一段"), null, null)).thenReturn(task);

        ApiResponse<?> response = controller.create(request);

        assertEquals("OK", response.getCode());
    }

    @Test
    @DisplayName("detail: 应按 taskId 返回任务详情")
    void detail_shouldReturnTaskDetail() {
        Instant now = Instant.now();
        Task task = visibleTask(4L, "task-4", null,
                null, 2L, TaskTypes.PPTPROMPT_PIPELINE, "_",
                TaskStatus.DONE, "{\"promptMarkdown\":\"body_1\"}",
                TaskWorkflowDefinitions.AGENT_PPTPROMPT_STAGE_RUN_KEY, null, null,
                "{\"generatedPrompt\":\"body_1: 新提示词\"}", now);
        when(taskQueryAppService.getTaskDetail("task-4")).thenReturn(task);

        ApiResponse<?> response = controller.detail("task-4");

        assertEquals("OK", response.getCode());
        com.notebook.learyAI.module.task.interfaces.dto.TaskDetailResponse data =
                (com.notebook.learyAI.module.task.interfaces.dto.TaskDetailResponse) response.getData();
        assertEquals("task-4", data.getTaskId());
        assertEquals("DONE", data.getStatus());
        assertEquals(Map.of("generatedPrompt", "body_1: 新提示词"), data.getViewData());
    }

    @Test
    @DisplayName("updateTaskStatus: status 非法应返回 KB-400")
    void updateTaskStatus_whenStatusInvalid_shouldThrowKb400() {
        TaskStatusUpdateRequest request = new TaskStatusUpdateRequest();
        request.setProjectId("p1");
        request.setStatus("bad-status");

        BizException ex = assertThrows(BizException.class, () -> controller.updateTaskStatus(1L, request));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("updateTaskStatus: changeType 为空应默认 status_change 并透传参数")
    void updateTaskStatus_whenValid_shouldDelegateWithDefaultChangeType() {
        TaskStatusUpdateRequest request = new TaskStatusUpdateRequest();
        request.setProjectId("p1");
        request.setStatus("done");
        request.setViewPatch(Map.of("a", 1));
        request.setInfo("info");
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");

        ApiResponse<Boolean> response = controller.updateTaskStatus(9L, request);

        assertEquals("OK", response.getCode());
        assertEquals(Boolean.TRUE, response.getData());
        verify(taskStatusService).updateTaskStatus(9L, "p1", TaskStatus.DONE, Map.of("a", 1),
                "info", "status_change");
    }

    @Test
    @DisplayName("retryTask: 应透传 projectId 与 taskId 到重试服务")
    void retryTask_shouldDelegate() {
        TaskRetryRequest request = new TaskRetryRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");

        ApiResponse<Boolean> response = controller.retryTask("task-9", request);

        assertEquals("OK", response.getCode());
        assertEquals(Boolean.TRUE, response.getData());
        verify(taskCommandAppService).retryTask("p1", "kb-1", "task-9");
    }

    @Test
    @DisplayName("retryTask: 缺少 kbId 应返回 KB-400")
    void retryTask_whenKbIdMissing_shouldThrowKb400() {
        TaskRetryRequest request = new TaskRetryRequest();
        request.setProjectId("p1");
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");

        BizException ex = assertThrows(BizException.class, () -> controller.retryTask("task-9", request));

        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("list: 应解析 types/statuses 并映射列表信息")
    void list_shouldParseAndMapResponse() {
        Instant now = Instant.now();
        Task task = visibleTask(1L, "task-1", "p1", null, 2L, "doc", "d1", TaskStatus.PROCESSING,
                "{\"info\":\"hello\",\"k\":1}", "doc:main", null, null, "{\"info\":\"hello\"}", now);
        when(taskQueryAppService.listTasks("p1", "kb-1", List.of("doc", "kb"),
                List.of("done", "processing"), null, null))
                .thenReturn(new TaskPage(List.of(task), 1, 1, 1));

        ApiResponse<TaskListResponse> response = controller.list("p1", "kb-1", "doc,kb", "done,processing", null, null);

        assertEquals("OK", response.getCode());
        assertEquals(1, response.getData().getItems().size());
        assertEquals("task-1", response.getData().getItems().get(0).getTaskId());
        assertEquals("doc:main", response.getData().getItems().get(0).getCurrentStage());
    }

    @Test
    @DisplayName("create: task metadata 非法 JSON 时应返回 KB-500")
    void create_whenTaskMetadataInvalidJson_shouldThrowKb500() {
        TaskCreateRequest request = new TaskCreateRequest();
        request.setProjectId("p1");
        request.setKbId("kb-1");
        request.setType(TaskTypes.DOCUMENT_PIPELINE);
        request.setTypeId("d1");
        request.setStatus("done");
        Task task = visibleTask(1L, "task-1", "p1", null, 2L, TaskTypes.DOCUMENT_PIPELINE, "d1",
                TaskStatus.DONE, "{bad-json}", null, null, null, "{bad-json}", Instant.now());
        when(taskCommandAppService.createTask("p1", TaskTypes.DOCUMENT_PIPELINE, "d1", TaskStatus.DONE,
                "kb-1", Map.of(), null, null)).thenReturn(task);

        BizException ex = assertThrows(BizException.class, () -> controller.create(request));
        assertEquals("KB-500", ex.getCode());
    }

    private Task visibleTask(Long taskRecordId, String publicTaskId, String projectId, String kbId, Long userId,
                             String type, String typeId, TaskStatus status, String pipelineContext,
                             String currentStage, String stagePayload, String stageResult, String viewData,
                             Instant now) {
        return new Task(taskRecordId, publicTaskId, projectId, kbId, userId, type, status,
                currentStage, pipelineContext, viewData, typeId, now, now);
    }
}
