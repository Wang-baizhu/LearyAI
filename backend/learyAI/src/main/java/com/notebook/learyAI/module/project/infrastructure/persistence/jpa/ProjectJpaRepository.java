// Responsibility: Spring Data JPA repository for ProjectPO.
package com.notebook.learyAI.module.project.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.project.infrastructure.persistence.po.ProjectPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ProjectJpaRepository extends JpaRepository<ProjectPO, UUID> {
    List<ProjectPO> findByIdIn(List<UUID> ids);

    Optional<ProjectPO> findTopByOwnerIdOrderByCreatedAtAsc(Long ownerId);
}
