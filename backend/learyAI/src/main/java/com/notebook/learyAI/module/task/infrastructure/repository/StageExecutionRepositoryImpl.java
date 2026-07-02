// Responsibility: Implement stage execution repository using JPA persistence.
package com.notebook.learyAI.module.task.infrastructure.repository;

import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.domain.repository.StageExecutionRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.jpa.StageExecutionJpaRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.po.StageExecutionPO;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public class StageExecutionRepositoryImpl implements StageExecutionRepository {
    private final StageExecutionJpaRepository jpaRepository;

    public StageExecutionRepositoryImpl(StageExecutionJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public StageExecution save(StageExecution stageExecution) {
        StageExecutionPO saved = jpaRepository.save(toPo(stageExecution));
        return toDomain(saved);
    }

    @Override
    public Optional<StageExecution> findById(Long id) {
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<StageExecution> findLatestByTaskIdAndStageKey(Long taskId, String stageKey) {
        if (taskId == null || taskId <= 0L || stageKey == null || stageKey.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findTopByTaskIdAndStageKeyOrderByCreatedAtDesc(taskId, stageKey.trim()).map(this::toDomain);
    }

    @Override
    public Optional<StageExecution> findLatestByTaskIdAndStatus(Long taskId, TaskStatus status) {
        if (taskId == null || taskId <= 0L || status == null) {
            return Optional.empty();
        }
        return jpaRepository.findTopByTaskIdAndStatusOrderByCreatedAtDesc(taskId, status.name()).map(this::toDomain);
    }

    @Override
    public List<StageExecution> findByTaskIdOrderByCreatedAtDesc(Long taskId) {
        if (taskId == null || taskId <= 0L) {
            return List.of();
        }
        return jpaRepository.findByTaskIdOrderByCreatedAtDesc(taskId).stream().map(this::toDomain).toList();
    }

    @Override
    public void deleteByTaskId(Long taskId) {
        if (taskId == null || taskId <= 0L) {
            return;
        }
        jpaRepository.deleteByTaskId(taskId);
    }

    private StageExecutionPO toPo(StageExecution stageExecution) {
        StageExecutionPO po = new StageExecutionPO();
        po.setId(stageExecution.getId());
        po.setTaskId(stageExecution.getTaskId());
        po.setStageKey(stageExecution.getStageKey());
        po.setExecutorType(stageExecution.getExecutorType());
        po.setExecutionType(stageExecution.getExecutionType());
        TaskStatus status = stageExecution.getStatus();
        po.setStatus(status == null ? null : status.name());
        po.setInputJson(stageExecution.getInputJson());
        po.setOutputJson(stageExecution.getOutputJson());
        po.setErrorJson(stageExecution.getErrorJson());
        po.setAttemptNo(stageExecution.getAttemptNo() == null || stageExecution.getAttemptNo() <= 0
                ? 1
                : stageExecution.getAttemptNo());
        po.setStartedAt(stageExecution.getStartedAt());
        po.setFinishedAt(stageExecution.getFinishedAt());
        Instant now = Instant.now();
        po.setCreatedAt(stageExecution.getCreatedAt() == null ? now : stageExecution.getCreatedAt());
        po.setUpdatedAt(stageExecution.getUpdatedAt() == null ? now : stageExecution.getUpdatedAt());
        return po;
    }

    private StageExecution toDomain(StageExecutionPO po) {
        TaskStatus status = po.getStatus() == null ? null : TaskStatus.valueOf(po.getStatus());
        return new StageExecution(
                po.getId(),
                po.getTaskId(),
                po.getStageKey(),
                po.getExecutorType(),
                po.getExecutionType(),
                status,
                po.getInputJson(),
                po.getOutputJson(),
                po.getErrorJson(),
                po.getAttemptNo(),
                po.getStartedAt(),
                po.getFinishedAt(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }
}
