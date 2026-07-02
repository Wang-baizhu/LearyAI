// Responsibility: Knowledge base domain entity.
package com.notebook.learyAI.module.kb.domain.model;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class KnowledgeBase {
    private final Long id;
    private final String kbId;
    private final String projectId;
    private final String name;
    private final String description;
    private final List<String> tags;
    private final Long ownerId;
    private final KnowledgeBaseVisibility visibility;
    private final Instant visitedAt;
    private final Map<String, Object> canvas;

    public KnowledgeBase(Long id, String kbId, String projectId, String name, String description, List<String> tags,
                         Long ownerId, KnowledgeBaseVisibility visibility, Instant visitedAt) {
        this(id, kbId, projectId, name, description, tags, ownerId, visibility, visitedAt, Map.of());
    }

    public KnowledgeBase(Long id, String kbId, String projectId, String name, String description, List<String> tags,
                         Long ownerId, KnowledgeBaseVisibility visibility, Instant visitedAt,
                         Map<String, Object> canvas) {
        this.id = id;
        this.kbId = kbId;
        this.projectId = projectId;
        this.name = name;
        this.description = description;
        this.tags = tags == null ? List.of() : List.copyOf(tags);
        this.ownerId = ownerId;
        this.visibility = visibility;
        this.visitedAt = visitedAt;
        this.canvas = canvas == null ? Map.of() : Collections.unmodifiableMap(new HashMap<>(canvas));
    }

    public KnowledgeBase(Long id, String kbId, String projectId, String name, String description, List<String> tags,
                         Long ownerId, KnowledgeBaseVisibility visibility, Instant visitedAt,
                         Map<String, Object> canvas, List<String> enabledTemplatePluginIds) {
        this(id, kbId, projectId, name, description, tags, ownerId, visibility, visitedAt, canvas);
    }

    public KnowledgeBase withUpdated(String name, String description, List<String> tags) {
        return new KnowledgeBase(this.id, this.kbId, this.projectId, name, description, tags, this.ownerId,
                this.visibility, this.visitedAt, this.canvas);
    }

    public KnowledgeBase withVisibility(KnowledgeBaseVisibility visibility) {
        return new KnowledgeBase(this.id, this.kbId, this.projectId, this.name, this.description, this.tags,
                this.ownerId, visibility, this.visitedAt, this.canvas);
    }

    public KnowledgeBase withVisitedAt(Instant visitedAt) {
        return new KnowledgeBase(this.id, this.kbId, this.projectId, this.name, this.description, this.tags,
                this.ownerId, this.visibility, visitedAt, this.canvas);
    }

    public KnowledgeBase withCanvas(Map<String, Object> canvas) {
        return new KnowledgeBase(this.id, this.kbId, this.projectId, this.name, this.description, this.tags,
                this.ownerId, this.visibility, this.visitedAt, canvas);
    }

    public KnowledgeBase withEnabledTemplatePluginIds(List<String> enabledTemplatePluginIds) {
        return new KnowledgeBase(this.id, this.kbId, this.projectId, this.name, this.description, this.tags,
                this.ownerId, this.visibility, this.visitedAt, this.canvas);
    }

    public Long getId() {
        return id;
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

    public KnowledgeBaseVisibility getVisibility() {
        return visibility;
    }

    public Instant getVisitedAt() {
        return visitedAt;
    }

    public Map<String, Object> getCanvas() {
        return canvas;
    }

    public List<String> getEnabledTemplatePluginIds() {
        return List.of();
    }
}
