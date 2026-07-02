// Responsibility: Represent a user's latest visit to a resource.
package com.notebook.learyAI.module.visit.domain.model;

import java.time.Instant;

public class UserResourceVisit {
    private final Long id;
    private final Long userId;
    private final UserResourceType resourceType;
    private final String resourceId;
    private final Instant lastVisitedAt;
    private final Instant createdAt;
    private final Instant updatedAt;

    public UserResourceVisit(Long id, Long userId, UserResourceType resourceType, String resourceId,
                             Instant lastVisitedAt, Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.userId = userId;
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.lastVisitedAt = lastVisitedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getUserId() {
        return userId;
    }

    public UserResourceType getResourceType() {
        return resourceType;
    }

    public String getResourceId() {
        return resourceId;
    }

    public Instant getLastVisitedAt() {
        return lastVisitedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
