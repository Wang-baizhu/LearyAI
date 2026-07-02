// Responsibility: JPA entity mapping for template plugin manifest records.
package com.notebook.learyAI.module.template.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "template_plugin_manifest",
        indexes = {
                @Index(name = "idx_template_plugin_manifest_plugin_id", columnList = "plugin_id"),
                @Index(name = "idx_template_plugin_manifest_name", columnList = "name"),
                @Index(name = "idx_template_plugin_manifest_project_plugin_status",
                        columnList = "project_id,plugin_id,status")
        })
public class TemplatePluginManifestPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "plugin_id", nullable = false, columnDefinition = "uuid")
    private UUID pluginId;

    @Column(name = "name", nullable = false, length = 64)
    private String name;

    @Column(name = "project_id", columnDefinition = "uuid")
    private UUID projectId;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "display_name", nullable = false, length = 128)
    private String displayName;

    @Column(name = "entry_uri", length = 1024)
    private String entryUri;

    @Column(name = "asset_base_uri", length = 1024)
    private String assetBaseUri;

    @Column(name = "sdk_version", nullable = false, length = 32)
    private String sdkVersion;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "capabilities_json", nullable = false, columnDefinition = "jsonb")
    private String capabilitiesJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "prompt_schema_json", nullable = false, columnDefinition = "jsonb")
    private String promptSchemaJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "data_bindings_json", nullable = false, columnDefinition = "jsonb")
    private String dataBindingsJson;

    @Column(nullable = false, length = 32)
    private String status;

    @Column(nullable = false, length = 32, columnDefinition = "varchar(32) default 'project'")
    private String scope;

    @Column(nullable = false, length = 32, columnDefinition = "varchar(32) default 'project'")
    private String visibility;

    @Column(name = "upload_state", nullable = false, length = 32, columnDefinition = "varchar(32) default 'empty'")
    private String uploadState;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "source_manifest_json", columnDefinition = "jsonb")
    private String sourceManifestJson;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "validation_result_json", columnDefinition = "jsonb")
    private String validationResultJson;

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

    public UUID getPluginId() {
        return pluginId;
    }

    public void setPluginId(UUID pluginId) {
        this.pluginId = pluginId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(UUID projectId) {
        this.projectId = projectId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(Long ownerId) {
        this.ownerId = ownerId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public void setDisplayName(String displayName) {
        this.displayName = displayName;
    }

    public String getEntryUri() {
        return entryUri;
    }

    public void setEntryUri(String entryUri) {
        this.entryUri = entryUri;
    }

    public String getAssetBaseUri() {
        return assetBaseUri;
    }

    public void setAssetBaseUri(String assetBaseUri) {
        this.assetBaseUri = assetBaseUri;
    }

    public String getSdkVersion() {
        return sdkVersion;
    }

    public void setSdkVersion(String sdkVersion) {
        this.sdkVersion = sdkVersion;
    }

    public String getCapabilitiesJson() {
        return capabilitiesJson;
    }

    public void setCapabilitiesJson(String capabilitiesJson) {
        this.capabilitiesJson = capabilitiesJson;
    }

    public String getPromptSchemaJson() {
        return promptSchemaJson;
    }

    public void setPromptSchemaJson(String promptSchemaJson) {
        this.promptSchemaJson = promptSchemaJson;
    }

    public String getDataBindingsJson() {
        return dataBindingsJson;
    }

    public void setDataBindingsJson(String dataBindingsJson) {
        this.dataBindingsJson = dataBindingsJson;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }

    public String getUploadState() {
        return uploadState;
    }

    public void setUploadState(String uploadState) {
        this.uploadState = uploadState;
    }

    public String getSourceManifestJson() {
        return sourceManifestJson;
    }

    public void setSourceManifestJson(String sourceManifestJson) {
        this.sourceManifestJson = sourceManifestJson;
    }

    public String getValidationResultJson() {
        return validationResultJson;
    }

    public void setValidationResultJson(String validationResultJson) {
        this.validationResultJson = validationResultJson;
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
