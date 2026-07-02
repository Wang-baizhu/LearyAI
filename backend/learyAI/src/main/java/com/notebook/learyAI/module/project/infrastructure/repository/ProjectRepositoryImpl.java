// Responsibility: Implement project repository using JPA persistence.
package com.notebook.learyAI.module.project.infrastructure.repository;

import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.module.project.infrastructure.persistence.jpa.ProjectJpaRepository;
import com.notebook.learyAI.module.project.infrastructure.persistence.po.ProjectPO;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class ProjectRepositoryImpl implements ProjectRepository {
    private final ProjectJpaRepository jpaRepository;

    public ProjectRepositoryImpl(ProjectJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public Project save(Project project) {
        ProjectPO saved = jpaRepository.save(toPo(project));
        return toDomain(saved);
    }

    @Override
    public Optional<Project> findById(String projectId) {
        java.util.UUID uuid = parseUuid(projectId);
        if (uuid == null) {
            return Optional.empty();
        }
        return jpaRepository.findById(uuid).map(this::toDomain);
    }

    @Override
    public boolean existsById(String projectId) {
        java.util.UUID uuid = parseUuid(projectId);
        return uuid != null && jpaRepository.existsById(uuid);
    }

    @Override
    public List<Project> findByIds(List<String> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return List.of();
        }
        List<java.util.UUID> ids = projectIds.stream()
                .map(this::parseUuid)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList());
        if (ids.isEmpty()) {
            return List.of();
        }
        return jpaRepository.findByIdIn(ids).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Project> findFirstByOwnerId(Long ownerId) {
        if (ownerId == null) {
            return Optional.empty();
        }
        return jpaRepository.findTopByOwnerIdOrderByCreatedAtAsc(ownerId).map(this::toDomain);
    }

    @Override
    public void deleteById(String projectId) {
        java.util.UUID uuid = parseUuid(projectId);
        if (uuid == null) {
            return;
        }
        jpaRepository.deleteById(uuid);
    }

    private ProjectPO toPo(Project project) {
        ProjectPO po = new ProjectPO();
        if (project.getId() != null && !project.getId().isBlank()) {
            po.setId(java.util.UUID.fromString(project.getId()));
        }
        po.setName(project.getName());
        po.setOwnerId(project.getOwnerId());
        po.setCreatedAt(project.getCreatedAt());
        po.setUpdatedAt(project.getUpdatedAt());
        return po;
    }

    private Project toDomain(ProjectPO po) {
        String id = po.getId() == null ? null : po.getId().toString();
        return new Project(id, po.getName(), po.getOwnerId(), po.getCreatedAt(), po.getUpdatedAt());
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
}
