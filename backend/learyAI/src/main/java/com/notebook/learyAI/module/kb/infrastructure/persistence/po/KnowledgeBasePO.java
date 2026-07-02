// Responsibility: JPA entity mapping for knowledge base table.
package com.notebook.learyAI.module.kb.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "knowledge_base",
        uniqueConstraints = @UniqueConstraint(columnNames = {"project_id", "name"}),
        indexes = {
            @Index(name = "idx_kb_project", columnList = "project_id"),
            @Index(name = "idx_kb_kb_id", columnList = "kb_id"),
            @Index(name = "idx_kb_visited", columnList = "visited_at")
        })
public class KnowledgeBasePO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "kb_id", nullable = false, unique = true, columnDefinition = "uuid")
    private UUID kbId;

    @Column(name = "project_id", nullable = false, columnDefinition = "uuid")
    private UUID projectId;

    @Column(nullable = false, length = 64)
    private String name;

    @Column(length = 512)
    private String description;

    @Column(length = 2000)
    private String tags;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(nullable = false, length = 16)
    private String visibility;

    @Column(name = "visited_at")
    private Instant visitedAt;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "canvas_json", columnDefinition = "jsonb")
    private String canvasJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "enabled_template_plugin_ids_json", columnDefinition = "jsonb")
    private String enabledTemplatePluginIdsJson;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UUID getKbId() {
        return kbId;
    }

    public void setKbId(UUID kbId) {
        this.kbId = kbId;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getTags() {
        return tags;
    }

    public void setTags(String tags) {
        this.tags = tags;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public Instant getVisitedAt() {
        return visitedAt;
    }

    public void setVisitedAt(Instant visitedAt) {
        this.visitedAt = visitedAt;
    }

    public String getCanvasJson() {
        return canvasJson;
    }

    public void setCanvasJson(String canvasJson) {
        this.canvasJson = canvasJson;
    }

    public String getEnabledTemplatePluginIdsJson() {
        return enabledTemplatePluginIdsJson;
    }

    public void setEnabledTemplatePluginIdsJson(String enabledTemplatePluginIdsJson) {
        this.enabledTemplatePluginIdsJson = enabledTemplatePluginIdsJson;
    }
}
