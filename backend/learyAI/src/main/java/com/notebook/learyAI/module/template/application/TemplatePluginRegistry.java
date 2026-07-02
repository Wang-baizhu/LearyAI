// Responsibility: Resolve template plugin metadata from the persisted manifest registry.
package com.notebook.learyAI.module.template.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.template.domain.repository.TemplatePluginManifestRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TemplatePluginRegistry {
    private final TemplatePluginManifestRepository manifestRepository;
    private final AuthzSdk authzSdk;

    public TemplatePluginRegistry(TemplatePluginManifestRepository manifestRepository,
                                  AuthzSdk authzSdk) {
        this.manifestRepository = manifestRepository;
        this.authzSdk = authzSdk;
    }

    public TemplatePluginManifest requirePluginById(Long userId, String projectId, String pluginId) {
        if (userId == null || userId <= 0) {
            throw new BizException("TEMPLATE-400", "userId required");
        }
        if (pluginId == null || pluginId.isBlank()) {
            throw new BizException("TEMPLATE-400", "pluginId required");
        }
        TemplatePluginManifest manifest = manifestRepository.findByPluginId(pluginId.trim())
                .orElseThrow(() -> new BizException("TEMPLATE-400", "pluginId invalid"));
        if (!isRuntimeAccessible(manifest, userId, projectId)) {
            throw new BizException("TEMPLATE-400", "pluginId invalid");
        }
        return manifest;
    }

    public List<TemplatePluginManifest> listAvailablePlugins(String projectId) {
        return manifestRepository.findActiveByProjectIdOrGlobal(projectId);
    }

    private boolean isRuntimeAccessible(TemplatePluginManifest manifest, Long userId, String projectId) {
        if (manifest == null) {
            return false;
        }
        if (!"active".equalsIgnoreCase(manifest.getStatus())
                || !"validated".equalsIgnoreCase(manifest.getUploadState())) {
            return false;
        }
        String visibility = manifest.getVisibility();
        if (visibility == null || visibility.isBlank()) {
            return false;
        }
        if ("private".equalsIgnoreCase(visibility)) {
            return userId.equals(manifest.getOwnerId());
        }
        if ("project".equalsIgnoreCase(visibility)) {
            String ownerProjectId = manifest.getProjectId();
            if (ownerProjectId == null || ownerProjectId.isBlank()) {
                return false;
            }
            return authzSdk.isMember(userId, ownerProjectId);
        }
        if ("public".equalsIgnoreCase(visibility)) {
            return true;
        }
        return false;
    }
}
