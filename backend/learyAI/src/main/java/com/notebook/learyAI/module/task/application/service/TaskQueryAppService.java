// Responsibility: Query task list with permission checks.
package com.notebook.learyAI.module.task.application.service;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineDefinition;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistries;
import com.notebook.learyAI.module.task.application.pipeline.TaskPipelineRegistry;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.List;

@Service
public class TaskQueryAppService {
    private static final int DEFAULT_PAGE = 1;
    private static final int DEFAULT_SIZE = 20;
    private static final int MAX_SIZE = 100;

    private final TaskAppService taskAppService;
    private final AuthzSdk authzSdk;
    private final TaskPipelineRegistry taskPipelineRegistry;

    @Autowired
    public TaskQueryAppService(TaskAppService taskAppService,
                               AuthzSdk authzSdk,
                               TaskPipelineRegistry taskPipelineRegistry) {
        this.taskAppService = taskAppService;
        this.authzSdk = authzSdk;
        this.taskPipelineRegistry = taskPipelineRegistry;
    }

    public TaskQueryAppService(TaskAppService taskAppService, AuthzSdk authzSdk) {
        this(taskAppService, authzSdk, TaskPipelineRegistries.defaultRegistry());
    }

    public TaskPage listTasks(String projectId, String kbId, Collection<String> types, Collection<String> statuses,
                              Integer page, Integer size) {
        Long userId = authzSdk.requireUserId();
        String normalizedProjectId = authzSdk.requireProjectId(projectId, "KB-400", "KB-400", "KB-404");
        try {
            authzSdk.requireRole(userId, normalizedProjectId, java.util.Set.of(
                    ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER));
        } catch (BizException ex) {
            if ("PROJECT-403".equals(ex.getCode())) {
                throw new BizException("KB-403", "project access denied");
            }
            throw ex;
        }
        String normalizedKbId = normalizeRequired(kbId, "kbId");
        List<String> normalizedTypes = normalizeTypes(types);
        if (normalizedTypes.isEmpty()) {
            throw new BizException("KB-400", "type required");
        }
        List<TaskStatus> normalizedStatuses = normalizeStatuses(statuses);
        int normalizedPage = normalizePage(page);
        int normalizedSize = normalizeSize(size);
        return taskAppService.findByProjectAndKbIdAndTypesAndStatuses(normalizedProjectId, normalizedKbId,
                normalizedTypes, normalizedStatuses, normalizedPage, normalizedSize);
    }

    public Task getTaskDetail(String taskId) {
        Long userId = authzSdk.requireUserId();
        String normalizedTaskId = normalizeRequired(taskId, "taskId");
        return taskAppService.findVisibleByPublicTaskIdAndUserId(normalizedTaskId, userId)
                .orElseThrow(() -> new BizException("KB-404", "task not found"));
    }

    private String normalizeRequired(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", fieldName + " required");
        }
        return value.trim();
    }

    private List<String> normalizeTypes(Collection<String> types) {
        if (types == null || types.isEmpty()) {
            return List.of();
        }
        List<String> normalized = new ArrayList<>();
        for (String type : types) {
            if (type == null || type.isBlank()) {
                continue;
            }
            String normalizedType = type.trim();
            TaskPipelineDefinition definition = taskPipelineRegistry.require(normalizedType);
            if (!definition.listable()) {
                throw new BizException("KB-400", "type invalid");
            }
            normalized.add(normalizedType);
        }
        return normalized;
    }

    private List<TaskStatus> normalizeStatuses(Collection<String> statuses) {
        if (statuses == null || statuses.isEmpty()) {
            return new ArrayList<>(EnumSet.allOf(TaskStatus.class));
        }
        List<TaskStatus> normalized = new ArrayList<>();
        for (String status : statuses) {
            if (status == null || status.isBlank()) {
                continue;
            }
            try {
                normalized.add(TaskStatus.valueOf(status.trim().toUpperCase()));
            } catch (IllegalArgumentException ex) {
                throw new BizException("KB-400", "status invalid");
            }
        }
        if (normalized.isEmpty()) {
            return new ArrayList<>(EnumSet.allOf(TaskStatus.class));
        }
        return normalized;
    }

    private int normalizePage(Integer page) {
        if (page == null) {
            return DEFAULT_PAGE;
        }
        if (page <= 0) {
            throw new BizException("KB-400", "page invalid");
        }
        return page;
    }

    private int normalizeSize(Integer size) {
        if (size == null) {
            return DEFAULT_SIZE;
        }
        if (size <= 0 || size > MAX_SIZE) {
            throw new BizException("KB-400", "size invalid");
        }
        return size;
    }
}
