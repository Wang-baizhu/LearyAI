// Responsibility: Spring Data repository for task_stage_execution table.
package com.notebook.learyAI.module.task.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.task.infrastructure.persistence.po.StageExecutionPO;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StageExecutionJpaRepository extends JpaRepository<StageExecutionPO, Long> {
    Optional<StageExecutionPO> findTopByTaskIdAndStageKeyOrderByCreatedAtDesc(Long taskId, String stageKey);

    Optional<StageExecutionPO> findTopByTaskIdAndStatusOrderByCreatedAtDesc(Long taskId, String status);

    List<StageExecutionPO> findByTaskIdOrderByCreatedAtDesc(Long taskId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    void deleteByTaskId(Long taskId);
}
