// Responsibility: Domain repository for stage executions.
package com.notebook.learyAI.module.task.domain.repository;

import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;

import java.util.List;
import java.util.Optional;

public interface StageExecutionRepository {
    StageExecution save(StageExecution stageExecution);

    Optional<StageExecution> findById(Long id);

    Optional<StageExecution> findLatestByTaskIdAndStageKey(Long taskId, String stageKey);

    Optional<StageExecution> findLatestByTaskIdAndStatus(Long taskId, TaskStatus status);

    List<StageExecution> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    void deleteByTaskId(Long taskId);
}
