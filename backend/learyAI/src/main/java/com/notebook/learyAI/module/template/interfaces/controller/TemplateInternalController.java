// Responsibility: Expose internal-only template manifest endpoints for backend workers.
package com.notebook.learyAI.module.template.interfaces.controller;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.template.application.TemplatePluginRegistry;
import com.notebook.learyAI.module.template.interfaces.dto.TemplateRuntimeManifestResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/templates")
public class TemplateInternalController {
    private final TemplatePluginRegistry templatePluginRegistry;
    private final AuthzSdk authzSdk;

    public TemplateInternalController(TemplatePluginRegistry templatePluginRegistry,
                                      AuthzSdk authzSdk) {
        this.templatePluginRegistry = templatePluginRegistry;
        this.authzSdk = authzSdk;
    }

    @GetMapping("/plugin-manifest")
    public ApiResponse<TemplateRuntimeManifestResponse> runtimeManifest(@RequestParam String projectId,
                                                                        @RequestParam String pluginId) {
        Long userId = authzSdk.requireUserId();
        var manifest = templatePluginRegistry.requirePluginById(userId, projectId, pluginId);
        return ApiResponse.ok("模板运行时清单查询成功", new TemplateRuntimeManifestResponse(
                manifest.getPluginId(),
                manifest.getName(),
                manifest.getPromptSchema(),
                manifest.getDataBindings()
        ));
    }
}
