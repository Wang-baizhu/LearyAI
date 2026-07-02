// Responsibility: Provide access to active template plugin manifests.
package com.notebook.learyAI.module.template.domain.repository;

import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifestPage;

import java.util.List;
import java.util.Optional;

public interface TemplatePluginManifestRepository {
    Optional<TemplatePluginManifest> findActiveByProjectIdOrGlobalByPluginId(String projectId, String pluginId);

    Optional<TemplatePluginManifest> findActiveByProjectIdOrGlobalByName(String projectId, String name);

    List<TemplatePluginManifest> findActiveByProjectIdOrGlobal(String projectId);

    Optional<TemplatePluginManifest> findByPluginId(String pluginId);

    Optional<TemplatePluginManifest> findLatestByPluginId(String pluginId);

    List<TemplatePluginManifest> findByOwnerId(Long ownerId);

    TemplatePluginManifestPage findByOwnerId(Long ownerId, String search, int page, int size);

    TemplatePluginManifest save(TemplatePluginManifest manifest);

    void deleteByPluginId(String pluginId);
}
