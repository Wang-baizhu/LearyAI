// Responsibility: Describe a registered template plugin manifest available to the template module.
package com.notebook.learyAI.module.template.domain.model;

import java.time.Instant;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class TemplatePluginManifest {
    private final String pluginId;
    private final String name;
    private final String projectId;
    private final Long ownerId;
    private final String displayName;
    private final String entryUri;
    private final String assetBaseUri;
    private final String sdkVersion;
    private final Map<String, Object> capabilities;
    private final Map<String, Object> promptSchema;
    private final Map<String, Object> dataBindings;
    private final String status;
    private final String scope;
    private final String visibility;
    private final String uploadState;
    private final Map<String, Object> sourceManifest;
    private final Map<String, Object> validationResult;
    private final Instant createdAt;
    private final Instant updatedAt;

    public TemplatePluginManifest(String pluginId, String name, String projectId, Long ownerId,
                                  String displayName, String entryUri, String sdkVersion,
                                  Map<String, Object> capabilities, Map<String, Object> promptSchema,
                                  Map<String, Object> dataBindings, String status) {
        this(pluginId, name, projectId, ownerId, displayName, entryUri, null, sdkVersion,
                capabilities, promptSchema, dataBindings, status, "project", "project", "empty",
                Map.of(), Map.of(), null, null);
    }

    public TemplatePluginManifest(String pluginId, String name, String projectId, Long ownerId,
                                  String displayName, String entryUri, String assetBaseUri, String sdkVersion,
                                  Map<String, Object> capabilities, Map<String, Object> promptSchema,
                                  Map<String, Object> dataBindings, String status, String scope, String visibility,
                                  String uploadState, Map<String, Object> sourceManifest, Instant createdAt,
                                  Instant updatedAt) {
        this(pluginId, name, projectId, ownerId, displayName, entryUri, assetBaseUri, sdkVersion,
                capabilities, promptSchema, dataBindings, status, scope, visibility, uploadState,
                sourceManifest, Map.of(), createdAt, updatedAt);
    }

    public TemplatePluginManifest(String pluginId, String name, String projectId, Long ownerId,
                                  String displayName, String entryUri, String assetBaseUri, String sdkVersion,
                                  Map<String, Object> capabilities, Map<String, Object> promptSchema,
                                  Map<String, Object> dataBindings, String status, String scope, String visibility,
                                  String uploadState, Map<String, Object> sourceManifest,
                                  Map<String, Object> validationResult, Instant createdAt, Instant updatedAt) {
        this.pluginId = pluginId;
        this.name = name;
        this.projectId = projectId;
        this.ownerId = ownerId;
        this.displayName = displayName;
        this.entryUri = entryUri;
        this.assetBaseUri = assetBaseUri;
        this.sdkVersion = sdkVersion;
        this.capabilities = immutableCopy(capabilities);
        this.promptSchema = immutableCopy(promptSchema);
        this.dataBindings = immutableCopy(dataBindings);
        this.status = status;
        this.scope = scope;
        this.visibility = visibility;
        this.uploadState = uploadState;
        this.sourceManifest = immutableCopy(sourceManifest);
        this.validationResult = immutableCopy(validationResult);
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    private Map<String, Object> immutableCopy(Map<String, Object> source) {
        if (source == null || source.isEmpty()) {
            return Collections.emptyMap();
        }
        return Collections.unmodifiableMap(new HashMap<>(source));
    }

    public String getPluginId() {
        return pluginId;
    }

    public String getName() {
        return name;
    }

    public String getProjectId() {
        return projectId;
    }

    public Long getOwnerId() {
        return ownerId;
    }

    public String getDisplayName() {
        return displayName;
    }

    public String getEntryUri() {
        return entryUri;
    }

    public String getSdkVersion() {
        return sdkVersion;
    }

    public String getAssetBaseUri() {
        return assetBaseUri;
    }

    public Map<String, Object> getCapabilities() {
        return capabilities;
    }

    public Map<String, Object> getPromptSchema() {
        return promptSchema;
    }

    public Map<String, Object> getDataBindings() {
        return dataBindings;
    }

    public String getStatus() {
        return status;
    }

    public String getScope() {
        return scope;
    }

    public String getVisibility() {
        return visibility;
    }

    public String getUploadState() {
        return uploadState;
    }

    public Map<String, Object> getSourceManifest() {
        return sourceManifest;
    }

    public Map<String, Object> getValidationResult() {
        return validationResult;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public boolean validationPassed() {
        Object value = validationResult.get("passed");
        return value instanceof Boolean bool && bool;
    }

    @SuppressWarnings("unchecked")
    public List<String> validationWarnings() {
        Object value = validationResult.get("warnings");
        if (!(value instanceof List<?> warnings)) {
            return List.of();
        }
        return warnings.stream().filter(String.class::isInstance).map(String.class::cast).toList();
    }
}
