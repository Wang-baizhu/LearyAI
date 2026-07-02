// Responsibility: Represent project membership.
package com.notebook.learyAI.module.project.domain.model;

import java.time.Instant;

public class ProjectMember {
    private final Long id;
    private final String projectId;
    private final Long userId;
    private final ProjectMemberRole role;
    private final ProjectMemberStatus status;
    private final Instant createdAt;
    private final Instant updatedAt;

    public ProjectMember(Long id, String projectId, Long userId, ProjectMemberRole role, ProjectMemberStatus status,
                         Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.projectId = projectId;
        this.userId = userId;
        this.role = role;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public String getProjectId() {
        return projectId;
    }

    public Long getUserId() {
        return userId;
    }

    public ProjectMemberRole getRole() {
        return role;
    }

    public ProjectMemberStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
