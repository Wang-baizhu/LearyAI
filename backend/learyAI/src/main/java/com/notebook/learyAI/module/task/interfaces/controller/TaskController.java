// Responsibility: Provide task command endpoints.
package com.notebook.learyAI.module.task.interfaces.controller;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.task.application.service.TaskCommandAppService;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistry;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistries;
import com.notebook.learyAI.module.task.application.service.TaskQueryAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.interfaces.dto.TaskCreateRequest;
import com.notebook.learyAI.module.task.interfaces.dto.TaskDetailResponse;
import com.notebook.learyAI.module.task.interfaces.dto.TaskListItemResponse;
import com.notebook.learyAI.module.task.interfaces.dto.TaskListResponse;
import com.notebook.learyAI.module.task.interfaces.dto.TaskRetryRequest;
import com.notebook.learyAI.module.task.interfaces.dto.TaskStatusUpdateRequest;
import com.notebook.learyAI.shared.api.ApiResponse;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    private final TaskStatusService taskStatusService;
    private final AuthzSdk authzSdk;
    private final TaskCommandAppService taskCommandAppService;
    private final TaskQueryAppService taskQueryAppService;
    private final TaskPipelineRegistry taskPipelineRegistry;
    private final ObjectMapper objectMapper;

    @Autowired
    public TaskController(TaskStatusService taskStatusService,
                          AuthzSdk authzSdk,
                          TaskCommandAppService taskCommandAppService,
                          TaskQueryAppService taskQueryAppService,
                          TaskPipelineRegistry taskPipelineRegistry,
                          ObjectMapper objectMapper) {
        this.taskStatusService = taskStatusService;
        this.authzSdk = authzSdk;
        this.taskCommandAppService = taskCommandAppService;
        this.taskQueryAppService = taskQueryAppService;
        this.taskPipelineRegistry = taskPipelineRegistry;
        this.objectMapper = objectMapper;
    }

    public TaskController(TaskStatusService taskStatusService,
                          AuthzSdk authzSdk,
                          TaskCommandAppService taskCommandAppService,
                          TaskQueryAppService taskQueryAppService,
                          ObjectMapper objectMapper) {
        this(taskStatusService, authzSdk, taskCommandAppService, taskQueryAppService,
                TaskPipelineRegistries.defaultRegistry(), objectMapper);
    }

    @GetMapping
    public ApiResponse<TaskListResponse> list(@RequestParam String projectId,
                                              @RequestParam String kbId,
                                              @RequestParam(required = false) String types,
                                              @RequestParam(required = false) String statuses,
                                              @RequestParam(required = false) Integer page,
                                              @RequestParam(required = false) Integer size) {
        List<String> typeList = splitValues(types);
        List<String> statusList = splitValues(statuses);
        TaskPage result = taskQueryAppService.listTasks(projectId, kbId, typeList, statusList, page, size);
        List<TaskListItemResponse> items = new ArrayList<>();
        for (Task task : result.getItems()) {
            Map<String, Object> viewData = readJsonMap(task.getViewData());
            String status = task.getStatus() == null ? null : task.getStatus().name();
            items.add(new TaskListItemResponse(requirePublicTaskId(task), task.getType(), task.getTypeId(), status,
                    normalizeCurrentStage(task.getCurrentStage()), viewData,
                    task.getCreatedAt(), task.getUpdatedAt()));
        }
        return ApiResponse.ok("任务列表查询成功",
                new TaskListResponse(items, result.getTotal(), result.getPage(), result.getSize()));
    }

    @GetMapping("/{taskId}")
    public ApiResponse<TaskDetailResponse> detail(@PathVariable String taskId) {
        Task task = taskQueryAppService.getTaskDetail(taskId);
        Map<String, Object> viewData = readJsonMap(task.getViewData());
        String statusValue = task.getStatus() == null ? null : task.getStatus().name();
        return ApiResponse.ok("任务详情查询成功",
                new TaskDetailResponse(requirePublicTaskId(task), task.getProjectId(), task.getUserId(),
                        task.getType(), task.getTypeId(), statusValue, normalizeCurrentStage(task.getCurrentStage()),
                        viewData, task.getCreatedAt(), task.getUpdatedAt()));
    }

    @PostMapping
    public ApiResponse<TaskDetailResponse> create(@RequestBody TaskCreateRequest request) {
        if (request == null) {
            throw new BizException("KB-400", "request required");
        }
        String type = normalizeRequired(request.getType(), "type");
        if (!taskPipelineRegistry.isExternallyCreatable(type)) {
            throw new BizException("KB-400", "type invalid");
        }
        String kbId = TaskTypes.PPTPROMPT_PIPELINE.equals(type)
                ? null
                : normalizeRequired(request.getKbId(), "kbId");
        TaskStatus status = parseStatus(request.getStatus());
        Map<String, Object> pipelineContext = new HashMap<>();
        if (request.getPipelineContext() != null) {
            pipelineContext.putAll(request.getPipelineContext());
        }
        Task task = taskCommandAppService.createTask(request.getProjectId(), type, request.getTypeId(),
                status, kbId, pipelineContext, request.getInfo(), request.getChangeType());
        Map<String, Object> viewData = readJsonMap(task.getViewData());
        String statusValue = task.getStatus() == null ? null : task.getStatus().name();
        return ApiResponse.ok("任务创建成功",
                new TaskDetailResponse(requirePublicTaskId(task), task.getProjectId(), task.getUserId(),
                        task.getType(), task.getTypeId(), statusValue, normalizeCurrentStage(task.getCurrentStage()),
                        viewData, task.getCreatedAt(),
                        task.getUpdatedAt()));
    }

    @PostMapping("/{taskRecordId}/status")
    public ApiResponse<Boolean> updateTaskStatus(@PathVariable Long taskRecordId,
                                                 @RequestBody TaskStatusUpdateRequest request) {
        if (request == null) {
            throw new BizException("KB-400", "request required");
        }
        String normalizedProjectId = normalizeProjectId(request.getProjectId());
        TaskStatus status = parseStatus(request.getStatus());
        String changeType = normalizeChangeType(request.getChangeType());
        taskStatusService.updateTaskStatus(taskRecordId, normalizedProjectId, status, request.getViewPatch(),
                request.getInfo(), changeType);
        return ApiResponse.ok("任务状态更新成功", Boolean.TRUE);
    }

    @PostMapping("/{taskId}/retry")
    public ApiResponse<Boolean> retryTask(@PathVariable String taskId,
                                          @RequestBody TaskRetryRequest request) {
        if (request == null) {
            throw new BizException("KB-400", "request required");
        }
        String normalizedProjectId = normalizeProjectId(request.getProjectId());
        String normalizedKbId = normalizeRequired(request.getKbId(), "kbId");
        taskCommandAppService.retryTask(normalizedProjectId, normalizedKbId, taskId);
        return ApiResponse.ok("任务重试成功", Boolean.TRUE);
    }

    private TaskStatus parseStatus(String status) {
        if (status == null || status.isBlank()) {
            throw new BizException("KB-400", "status required");
        }
        try {
            return TaskStatus.valueOf(status.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new BizException("KB-400", "status invalid");
        }
    }

    private String normalizeChangeType(String changeType) {
        if (changeType == null || changeType.isBlank()) {
            return "status_change";
        }
        return changeType.trim();
    }

    private String normalizeProjectId(String projectId) {
        return authzSdk.requireProjectId(projectId, "KB-400", "KB-400", "KB-404");
    }

    private String normalizeRequired(String raw, String fieldName) {
        if (raw == null || raw.isBlank()) {
            throw new BizException("KB-400", fieldName + " required");
        }
        return raw.trim();
    }

    private Map<String, Object> readJsonMap(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "json parse failed");
        }
    }

    private String normalizeText(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return raw.trim();
    }

    private String normalizeCurrentStage(String currentStage) {
        if (currentStage == null || currentStage.isBlank()) {
            return null;
        }
        return currentStage.trim();
    }

    private String requirePublicTaskId(Task task) {
        if (task == null || task.getPublicTaskId() == null || task.getPublicTaskId().isBlank()) {
            throw new BizException("KB-500", "publicTaskId required");
        }
        return task.getPublicTaskId().trim();
    }

    private List<String> splitValues(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        String[] parts = raw.split(",");
        List<String> values = new ArrayList<>();
        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            values.add(part.trim());
        }
        return values;
    }
}
