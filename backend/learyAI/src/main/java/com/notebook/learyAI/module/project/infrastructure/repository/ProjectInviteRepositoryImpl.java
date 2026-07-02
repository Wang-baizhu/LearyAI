// Responsibility: Implement project invite repository using JPA persistence.
package com.notebook.learyAI.module.project.infrastructure.repository;

import com.notebook.learyAI.module.project.domain.model.ProjectInvite;
import com.notebook.learyAI.module.project.domain.model.ProjectInviteStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectInviteRepository;
import com.notebook.learyAI.module.project.infrastructure.persistence.jpa.ProjectInviteJpaRepository;
import com.notebook.learyAI.module.project.infrastructure.persistence.po.ProjectInvitePO;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Repository
public class ProjectInviteRepositoryImpl implements ProjectInviteRepository {
    private final ProjectInviteJpaRepository jpaRepository;

    public ProjectInviteRepositoryImpl(ProjectInviteJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public ProjectInvite save(ProjectInvite invite) {
        ProjectInvitePO saved = jpaRepository.save(toPo(invite));
        return toDomain(saved);
    }

    @Override
    public Optional<ProjectInvite> findById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<ProjectInvite> findByCode(String code) {
        if (code == null || code.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findByCode(code.trim()).map(this::toDomain);
    }

    @Override
    public List<ProjectInvite> findByProjectId(String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return List.of();
        }
        return jpaRepository.findByProjectIdOrderByCreatedAtDesc(projectUuid).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public void deleteByProjectId(String projectId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return;
        }
        jpaRepository.deleteByProjectId(projectUuid);
    }

    private ProjectInvitePO toPo(ProjectInvite invite) {
        ProjectInvitePO po = new ProjectInvitePO();
        po.setId(invite.getId());
        if (invite.getProjectId() != null && !invite.getProjectId().isBlank()) {
            po.setProjectId(java.util.UUID.fromString(invite.getProjectId()));
        }
        po.setCode(invite.getCode());
        po.setCreatorId(invite.getCreatorId());
        po.setMaxUse(invite.getMaxUse());
        po.setUsedCount(invite.getUsedCount());
        po.setStatus(invite.getStatus() == null ? ProjectInviteStatus.ACTIVE.name() : invite.getStatus().name());
        po.setExpiresAt(invite.getExpiresAt());
        po.setCreatedAt(invite.getCreatedAt());
        po.setUpdatedAt(invite.getUpdatedAt());
        return po;
    }

    private ProjectInvite toDomain(ProjectInvitePO po) {
        String projectId = po.getProjectId() == null ? null : po.getProjectId().toString();
        ProjectInviteStatus status = po.getStatus() == null
                ? ProjectInviteStatus.ACTIVE
                : ProjectInviteStatus.valueOf(po.getStatus());
        return new ProjectInvite(po.getId(), projectId, po.getCode(), po.getCreatorId(), po.getMaxUse(),
                po.getUsedCount(), status, po.getExpiresAt(), po.getCreatedAt(), po.getUpdatedAt());
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
