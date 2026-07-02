// Responsibility: Spring Data repository for task table.
package com.notebook.learyAI.module.task.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskPO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TaskJpaRepository extends JpaRepository<TaskPO, Long> {
    @Query(value = """
            SELECT *
            FROM task
            WHERE project_id = :projectId
              AND pipeline_type = :pipelineType
              AND NULLIF(CAST(CAST(context_json AS jsonb) ->> 'docId' AS text), '') = :docId
            ORDER BY created_at DESC
            LIMIT 1
            """, nativeQuery = true)
    Optional<TaskPO> findLatestVisibleByProjectIdAndPipelineTypeAndDocId(@Param("projectId") java.util.UUID projectId,
                                                                          @Param("pipelineType") String pipelineType,
                                                                          @Param("docId") String docId);

    Optional<TaskPO> findByIdAndProjectId(Long id, java.util.UUID projectId);

    Optional<TaskPO> findByPublicTaskIdAndProjectId(String publicTaskId, java.util.UUID projectId);

    Optional<TaskPO> findByPublicTaskIdAndUserId(String publicTaskId, Long userId);

    Optional<TaskPO> findByPublicTaskIdAndUserIdAndProjectIdAndKbIdAndPipelineType(String publicTaskId,
                                                                                    Long userId,
                                                                                    java.util.UUID projectId,
                                                                                    String kbId,
                                                                                    String pipelineType);

    Page<TaskPO> findByProjectIdAndKbIdAndPipelineTypeInAndStatusInOrderByCreatedAtDesc(
            java.util.UUID projectId,
            String kbId,
            Collection<String> pipelineTypes,
            Collection<String> status,
            Pageable pageable
    );

    List<TaskPO> findByPipelineTypeAndStatusAndUpdatedAtBefore(String pipelineType, String status, Instant updatedAt);

    List<TaskPO> findByStatusInAndUpdatedAtBeforeOrderByUpdatedAtAsc(Collection<String> statuses,
                                                                     Instant updatedAt);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    void deleteByIdAndProjectId(Long id, java.util.UUID projectId);
}
