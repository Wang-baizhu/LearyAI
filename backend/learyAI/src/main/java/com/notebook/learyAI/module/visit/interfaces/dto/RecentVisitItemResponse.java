// Responsibility: Serialize recent visit item payloads.
package com.notebook.learyAI.module.visit.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

public class RecentVisitItemResponse {
    private final String resourceType;
    private final String resourceId;
    private final Instant visitedAt;
    private final boolean available;
    private final String title;
    @Schema(nullable = true)
    private final String description;
    private final String projectId;
    @Schema(nullable = true)
    private final String kbId;

    public RecentVisitItemResponse(String resourceType,
                                   String resourceId,
                                   Instant visitedAt,
                                   boolean available,
                                   String title,
                                   String description,
                                   String projectId,
                                   String kbId) {
        this.resourceType = resourceType;
        this.resourceId = resourceId;
        this.visitedAt = visitedAt;
        this.available = available;
        this.title = title;
        this.description = description;
        this.projectId = projectId;
        this.kbId = kbId;
    }

    public String getResourceType() {
        return resourceType;
    }

    public String getResourceId() {
        return resourceId;
    }

    public Instant getVisitedAt() {
        return visitedAt;
    }

    public boolean isAvailable() {
        return available;
    }

    public String getTitle() {
        return title;
    }

    @Schema(nullable = true)
    public String getDescription() {
        return description;
    }

    public String getProjectId() {
        return projectId;
    }

    @Schema(nullable = true)
    public String getKbId() {
        return kbId;
    }
}
