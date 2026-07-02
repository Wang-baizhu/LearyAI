// Responsibility: Project response payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import java.time.Instant;

public class ProjectResponse {
    private final String projectId;
    private final String name;
    private final String role;
    private final Instant createdAt;
    private final Instant updatedAt;

    public ProjectResponse(String projectId, String name, String role, Instant createdAt, Instant updatedAt) {
        this.projectId = projectId;
        this.name = name;
        this.role = role;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
