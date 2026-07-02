// Responsibility: Project member response payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import java.time.Instant;

public class ProjectMemberResponse {
    private final Long userId;
    private final String name;
    private final String role;
    private final String status;
    private final Instant createdAt;

    public ProjectMemberResponse(Long userId, String name, String role, String status, Instant createdAt) {
        this.userId = userId;
        this.name = name;
        this.role = role;
        this.status = status;
        this.createdAt = createdAt;
    }

    public Long getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getRole() {
        return role;
    }

    public String getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
