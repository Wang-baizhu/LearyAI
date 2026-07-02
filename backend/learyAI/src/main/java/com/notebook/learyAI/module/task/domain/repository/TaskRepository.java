// Responsibility: Domain repository for tasks.
package com.notebook.learyAI.module.task.domain.repository;

import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskRepository {
    Task save(Task task);

    Optional<Task> findLatestByTypeAndTypeId(String projectId, String type, String typeId);

    Optional<Task> findLatestDocumentPipelineByDocId(String projectId, String docId);

    Optional<Task> findById(Long id);

    Optional<Task> findById(Long id, String projectId);

    Optional<Task> findVisibleByPublicTaskId(String publicTaskId, String projectId);

    Optional<Task> findVisibleByPublicTaskIdAndUserId(String publicTaskId, Long userId);

    Optional<Task> findVisibleSearchPipelineByPublicTaskIdAndScope(String publicTaskId, Long userId, String projectId,
                                                                   String kbId);

    TaskPage findByProjectAndKbIdAndTypesAndStatuses(String projectId, String kbId, Collection<String> types,
                                                     Collection<String> statuses, int page, int size);

    List<Task> findByTypeAndStatusAndUpdatedAtBefore(String type, TaskStatus status, Instant updatedAt);

    List<Task> findVisibleByStatusesAndUpdatedAtBefore(Collection<TaskStatus> statuses, Instant updatedAt);

    void deleteByIdAndProjectId(Long id, String projectId);
}
