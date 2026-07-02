// Responsibility: Knowledge base response payload.
package com.notebook.learyAI.module.kb.interfaces.dto;

import java.time.Instant;
import java.util.List;

public class KnowledgeBaseResponse {
    private final String kbId;
    private final String projectId;
    private final String name;
    private final String description;
    private final List<String> tags;
    private final Long ownerId;
    private final String visibility;
    private final Instant visitedAt;

    public KnowledgeBaseResponse(String kbId, String projectId, String name, String description,
                                 List<String> tags, Long ownerId, String visibility, Instant visitedAt) {
        this.kbId = kbId;
        this.projectId = projectId;
        this.name = name;
        this.description = description;
        this.tags = tags;
        this.ownerId = ownerId;
        this.visibility = visibility;
        this.visitedAt = visitedAt;
    }

    public String getKbId() {
        return kbId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public List<String> getTags() {
        return tags;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getVisibility() {
        return visibility;
    }

    public Instant getVisitedAt() {
        return visitedAt;
    }
}
