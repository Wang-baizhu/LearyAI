// Responsibility: Project domain entity as tenant boundary.
package com.notebook.learyAI.module.project.domain.model;

import java.time.Instant;

public class Project {
    private final String id;
    private final String name;
    private final Long ownerId;
    private final Instant createdAt;
    private final Instant updatedAt;

    public Project(String id, String name, Long ownerId, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.name = name;
        this.ownerId = ownerId;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public String getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
