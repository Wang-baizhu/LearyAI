// Responsibility: Carry paged owned template plugin manifest results.
package com.notebook.learyAI.module.template.domain.model;

import java.util.List;

public record TemplatePluginManifestPage(List<TemplatePluginManifest> items, long total, int page, int size) {
}
