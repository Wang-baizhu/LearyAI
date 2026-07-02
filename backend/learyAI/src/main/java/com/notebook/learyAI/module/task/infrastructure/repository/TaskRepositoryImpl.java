// Responsibility: Implement task repository using JPA persistence.
package com.notebook.learyAI.module.task.infrastructure.repository;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.domain.repository.TaskRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.jpa.TaskJpaRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskPO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class TaskRepositoryImpl implements TaskRepository {
    private final TaskJpaRepository jpaRepository;
    private final ObjectMapper objectMapper;

    public TaskRepositoryImpl(TaskJpaRepository jpaRepository, ObjectMapper objectMapper) {
        this.jpaRepository = jpaRepository;
        this.objectMapper = objectMapper;
    }

    @Override
    public Task save(Task task) {
        TaskPO saved = jpaRepository.save(toPo(task));
        return toDomain(saved);
    }

    @Override
    public Optional<Task> findLatestByTypeAndTypeId(String projectId, String type, String typeId) {
        if (TaskTypes.DOCUMENT_PIPELINE.equals(type)) {
            return findLatestDocumentPipelineByDocId(projectId, typeId);
        }
        if (TaskTypes.TEMPLATE_PIPELINE.equals(type)
                || TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE.equals(type)
                || TaskTypes.SEARCH_PIPELINE.equals(type)
                || TaskTypes.PPTPROMPT_PIPELINE.equals(type)) {
            return Optional.empty();
        }
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return Optional.empty();
        }
        return Optional.empty();
    }

    @Override
    public Optional<Task> findLatestDocumentPipelineByDocId(String projectId, String docId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null || docId == null || docId.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findLatestVisibleByProjectIdAndPipelineTypeAndDocId(
                        projectUuid,
                        TaskTypes.DOCUMENT_PIPELINE,
                        docId.trim()
                )
                .map(this::toDomain);
    }

    @Override
    public Optional<Task> findById(Long id) {
        if (id == null || id <= 0L) {
            return Optional.empty();
        }
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<Task> findById(Long id, String projectId) {
        if (projectId == null || projectId.isBlank()) {
            return findById(id);
        }
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByIdAndProjectId(id, projectUuid).map(this::toDomain);
    }

    @Override
    public Optional<Task> findVisibleByPublicTaskId(String publicTaskId, String projectId) {
        if (publicTaskId == null || publicTaskId.isBlank()) {
            return Optional.empty();
        }
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findByPublicTaskIdAndProjectId(publicTaskId.trim(), projectUuid)
                .map(this::toDomain);
    }

    @Override
    public Optional<Task> findVisibleByPublicTaskIdAndUserId(String publicTaskId, Long userId) {
        if (publicTaskId == null || publicTaskId.isBlank() || userId == null || userId <= 0L) {
            return Optional.empty();
        }
        return jpaRepository.findByPublicTaskIdAndUserId(publicTaskId.trim(), userId)
                .map(this::toDomain);
    }

    @Override
    public Optional<Task> findVisibleSearchPipelineByPublicTaskIdAndScope(String publicTaskId, Long userId,
                                                                          String projectId, String kbId) {
        if (publicTaskId == null || publicTaskId.isBlank() || userId == null || userId <= 0L) {
            return Optional.empty();
        }
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null || kbId == null || kbId.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findByPublicTaskIdAndUserIdAndProjectIdAndKbIdAndPipelineType(
                        publicTaskId.trim(), userId, projectUuid, kbId.trim(),
                        TaskTypes.SEARCH_PIPELINE
                )
                .map(this::toDomain);
    }

    @Override
    public TaskPage findByProjectAndKbIdAndTypesAndStatuses(String projectId, String kbId, Collection<String> types,
                                                            Collection<String> statuses, int page, int size) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null || kbId == null || kbId.isBlank()) {
            return new TaskPage(List.of(), 0, page, size);
        }
        if (types == null || types.isEmpty()) {
            return new TaskPage(List.of(), 0, page, size);
        }
        Page<TaskPO> result = jpaRepository.findByProjectIdAndKbIdAndPipelineTypeInAndStatusInOrderByCreatedAtDesc(
                projectUuid, kbId.trim(), types, statuses, PageRequest.of(page - 1, size)
        );
        java.util.List<Task> items = new ArrayList<>();
        for (TaskPO po : result.getContent()) {
            items.add(toDomain(po));
        }
        return new TaskPage(items, result.getTotalElements(), page, size);
    }

    @Override
    public List<Task> findByTypeAndStatusAndUpdatedAtBefore(String type, TaskStatus status, Instant updatedAt) {
        List<TaskPO> results = jpaRepository.findByPipelineTypeAndStatusAndUpdatedAtBefore(type, status.name(), updatedAt);
        List<Task> items = new ArrayList<>();
        for (TaskPO po : results) {
            items.add(toDomain(po));
        }
        return items;
    }

    @Override
    public List<Task> findVisibleByStatusesAndUpdatedAtBefore(Collection<TaskStatus> statuses, Instant updatedAt) {
        if (statuses == null || statuses.isEmpty()) {
            return List.of();
        }
        List<String> statusNames = new ArrayList<>();
        for (TaskStatus status : statuses) {
            if (status != null) {
                statusNames.add(status.name());
            }
        }
        if (statusNames.isEmpty()) {
            return List.of();
        }
        List<TaskPO> results = jpaRepository.findByStatusInAndUpdatedAtBeforeOrderByUpdatedAtAsc(
                statusNames, updatedAt
        );
        List<Task> items = new ArrayList<>();
        for (TaskPO po : results) {
            items.add(toDomain(po));
        }
        return items;
    }

    @Override
    public void deleteByIdAndProjectId(Long id, String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return;
        }
        jpaRepository.deleteByIdAndProjectId(id, projectUuid);
    }

    private TaskPO toPo(Task task) {
        TaskPO po = new TaskPO();
        po.setId(task.getTaskRecordId());
        po.setPublicTaskId(normalizePublicTaskId(task.getPublicTaskId()));
        if (task.getProjectId() != null && !task.getProjectId().isBlank()) {
            po.setProjectId(java.util.UUID.fromString(task.getProjectId()));
        }
        po.setKbId(task.getKbId());
        po.setUserId(task.getUserId());
        po.setPipelineType(task.getType());
        TaskStatus status = task.getStatus();
        po.setStatus(status == null ? null : status.name());
        po.setContextJson(task.getPipelineContext());
        po.setCurrentStageKey(task.getCurrentStage());
        po.setViewJson(task.getViewData());
        Instant createdAt = task.getCreatedAt();
        Instant updatedAt = task.getUpdatedAt();
        Instant now = Instant.now();
        po.setCreatedAt(createdAt == null ? now : createdAt);
        po.setUpdatedAt(updatedAt == null ? now : updatedAt);
        return po;
    }

    private Task toDomain(TaskPO po) {
        TaskStatus status = po.getStatus() == null ? null : TaskStatus.valueOf(po.getStatus());
        String projectId = po.getProjectId() == null ? null : po.getProjectId().toString();
        String pipelineType = po.getPipelineType();
        String contextJson = po.getContextJson();
        String currentStageKey = po.getCurrentStageKey();
        String viewJson = po.getViewJson();
        String resolvedTypeId = resolveVisibleTaskTypeId(po, pipelineType, contextJson);
        return new Task(
                po.getId(),
                po.getPublicTaskId(),
                projectId,
                po.getKbId(),
                po.getUserId(),
                pipelineType,
                status,
                currentStageKey,
                contextJson,
                viewJson,
                resolvedTypeId,
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }

    private String resolveVisibleTaskTypeId(TaskPO po, String pipelineType, String contextJson) {
        if (TaskTypes.DOCUMENT_PIPELINE.equals(pipelineType)) {
            return readJsonText(contextJson, "docId");
        }
        if (TaskTypes.TEMPLATE_PIPELINE.equals(pipelineType)
                || TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE.equals(pipelineType)
                || TaskTypes.SEARCH_PIPELINE.equals(pipelineType)
                || TaskTypes.PPTPROMPT_PIPELINE.equals(pipelineType)) {
            return "_";
        }
        return null;
    }

    private String normalizePublicTaskId(String publicTaskId) {
        if (publicTaskId != null && !publicTaskId.isBlank()) {
            return publicTaskId.trim();
        }
        return UUID.randomUUID().toString();
    }

    private java.util.UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return java.util.UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private String readJsonText(String rawJson, String key) {
        if (rawJson == null || rawJson.isBlank() || key == null || key.isBlank()) {
            return null;
        }
        try {
            java.util.Map<String, Object> payload = objectMapper.readValue(rawJson, new TypeReference<java.util.Map<String, Object>>() {});
            Object value = payload.get(key);
            if (!(value instanceof String text) || text.isBlank()) {
                return null;
            }
            return text.trim();
        } catch (Exception ex) {
            return null;
        }
    }
}
