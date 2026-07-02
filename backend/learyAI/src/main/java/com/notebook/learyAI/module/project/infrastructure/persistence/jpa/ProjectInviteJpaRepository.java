// Responsibility: Spring Data JPA repository for ProjectInvitePO.
package com.notebook.learyAI.module.project.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.project.infrastructure.persistence.po.ProjectInvitePO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectInviteJpaRepository extends JpaRepository<ProjectInvitePO, Long> {
    Optional<ProjectInvitePO> findById(Long id);

    Optional<ProjectInvitePO> findByCode(String code);

    List<ProjectInvitePO> findByProjectIdOrderByCreatedAtDesc(UUID projectId);

    void deleteByProjectId(UUID projectId);
}
