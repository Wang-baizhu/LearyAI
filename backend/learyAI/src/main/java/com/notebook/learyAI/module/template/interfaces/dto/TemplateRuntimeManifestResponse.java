// Responsibility: Expose the minimal runtime manifest required by template workers.
package com.notebook.learyAI.module.template.interfaces.dto;

import java.util.Map;

public record TemplateRuntimeManifestResponse(
        String pluginId,
        String name,
        Map<String, Object> promptSchema,
        Map<String, Object> dataBindings
) {
}
