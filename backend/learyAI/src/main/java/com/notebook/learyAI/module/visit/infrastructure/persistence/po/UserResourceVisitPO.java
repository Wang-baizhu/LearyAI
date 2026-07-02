// Responsibility: JPA entity mapping for user_resource_visit table.
package com.notebook.learyAI.module.visit.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(name = "user_resource_visit",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_resource_visit",
                columnNames = {"user_id", "resource_type", "resource_id"}),
        indexes = {
                @Index(name = "idx_user_resource_visit_user_type_time",
                        columnList = "user_id, resource_type, last_visited_at"),
                @Index(name = "idx_user_resource_visit_resource",
                        columnList = "resource_type, resource_id")
        })
public class UserResourceVisitPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "resource_type", nullable = false, length = 32)
    private String resourceType;

    @Column(name = "resource_id", nullable = false, length = 64)
    private String resourceId;

    @Column(name = "last_visited_at", nullable = false)
    private Instant lastVisitedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getResourceType() {
        return resourceType;
    }

    public void setResourceType(String resourceType) {
        this.resourceType = resourceType;
    }

    public String getResourceId() {
        return resourceId;
    }

    public void setResourceId(String resourceId) {
        this.resourceId = resourceId;
    }

    public Instant getLastVisitedAt() {
        return lastVisitedAt;
    }

    public void setLastVisitedAt(Instant lastVisitedAt) {
        this.lastVisitedAt = lastVisitedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
