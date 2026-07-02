// Responsibility: Spring Data JPA repository for ProjectMemberPO.
package com.notebook.learyAI.module.project.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.project.infrastructure.persistence.po.ProjectMemberPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface ProjectMemberJpaRepository extends JpaRepository<ProjectMemberPO, Long> {
    boolean existsByProjectIdAndUserIdAndStatus(UUID projectId, Long userId, String status);

    boolean existsByProjectIdAndUserIdAndRoleAndStatus(UUID projectId, Long userId, String role, String status);

    java.util.List<ProjectMemberPO> findByUserIdAndStatus(Long userId, String status);

    java.util.List<ProjectMemberPO> findByProjectIdAndStatus(UUID projectId, String status);

    java.util.Optional<ProjectMemberPO> findByProjectIdAndUserId(UUID projectId, Long userId);

    java.util.Optional<ProjectMemberPO> findByProjectIdAndUserIdAndStatus(UUID projectId, Long userId, String status);

    void deleteByProjectIdAndUserId(UUID projectId, Long userId);

    void deleteByProjectId(UUID projectId);
}
