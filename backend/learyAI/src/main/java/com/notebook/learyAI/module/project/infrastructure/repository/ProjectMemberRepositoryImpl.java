// Responsibility: Implement project member repository using JPA persistence.
package com.notebook.learyAI.module.project.infrastructure.repository;

import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.infrastructure.persistence.jpa.ProjectMemberJpaRepository;
import com.notebook.learyAI.module.project.infrastructure.persistence.po.ProjectMemberPO;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
@Repository
public class ProjectMemberRepositoryImpl implements ProjectMemberRepository {
    private final ProjectMemberJpaRepository jpaRepository;

    public ProjectMemberRepositoryImpl(ProjectMemberJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public ProjectMember save(ProjectMember member) {
        ProjectMemberPO saved = jpaRepository.save(toPo(member));
        return toDomain(saved);
    }

    @Override
    public Optional<ProjectMemberRole> findActiveRole(String projectId, Long userId) {
        java.util.UUID uuid = parseUuid(projectId);
        if (uuid == null || userId == null) {
            return Optional.empty();
        }
        return jpaRepository.findByProjectIdAndUserIdAndStatus(uuid, userId, ProjectMemberStatus.ACTIVE.name())
                .map(po -> ProjectMemberRole.valueOf(po.getRole()));
    }

    @Override
    public List<ProjectMember> findByUserId(Long userId) {
        if (userId == null) {
            return List.of();
        }
        return jpaRepository.findByUserIdAndStatus(userId, ProjectMemberStatus.ACTIVE.name()).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<ProjectMember> findByProjectId(String projectId) {
        java.util.UUID uuid = parseUuid(projectId);
        if (uuid == null) {
            return List.of();
        }
        return jpaRepository.findByProjectIdAndStatus(uuid, ProjectMemberStatus.ACTIVE.name()).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<ProjectMember> findByProjectIdAndUserId(String projectId, Long userId) {
        java.util.UUID uuid = parseUuid(projectId);
        if (uuid == null || userId == null) {
            return Optional.empty();
        }
        return jpaRepository.findByProjectIdAndUserId(uuid, userId).map(this::toDomain);
    }

    @Override
    public void deleteByProjectIdAndUserId(String projectId, Long userId) {
        java.util.UUID uuid = parseUuid(projectId);
        if (uuid == null || userId == null) {
            return;
        }
        jpaRepository.deleteByProjectIdAndUserId(uuid, userId);
    }

    @Override
    public void deleteByProjectId(String projectId) {
        java.util.UUID uuid = parseUuid(projectId);
        if (uuid == null) {
            return;
        }
        jpaRepository.deleteByProjectId(uuid);
    }

    private ProjectMemberPO toPo(ProjectMember member) {
        ProjectMemberPO po = new ProjectMemberPO();
        po.setId(member.getId());
        if (member.getProjectId() != null && !member.getProjectId().isBlank()) {
            po.setProjectId(java.util.UUID.fromString(member.getProjectId()));
        }
        po.setUserId(member.getUserId());
        po.setRole(member.getRole() == null ? ProjectMemberRole.MEMBER.name() : member.getRole().name());
        po.setStatus(member.getStatus() == null ? ProjectMemberStatus.ACTIVE.name() : member.getStatus().name());
        po.setCreatedAt(member.getCreatedAt());
        po.setUpdatedAt(member.getUpdatedAt());
        return po;
    }

    private ProjectMember toDomain(ProjectMemberPO po) {
        String projectId = po.getProjectId() == null ? null : po.getProjectId().toString();
        ProjectMemberRole role = ProjectMemberRole.valueOf(po.getRole());
        ProjectMemberStatus status = ProjectMemberStatus.valueOf(po.getStatus());
        return new ProjectMember(po.getId(), projectId, po.getUserId(), role, status, po.getCreatedAt(),
                po.getUpdatedAt());
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
