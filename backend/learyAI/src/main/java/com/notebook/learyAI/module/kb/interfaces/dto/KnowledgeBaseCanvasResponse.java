// Responsibility: Response payload for a knowledge base canvas snapshot.
package com.notebook.learyAI.module.kb.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;

public class KnowledgeBaseCanvasResponse {
    @Schema(additionalProperties = Schema.AdditionalPropertiesValue.TRUE)
    private final Map<String, Object> canvas;

    public KnowledgeBaseCanvasResponse(Map<String, Object> canvas) {
        this.canvas = canvas;
    }

    public Map<String, Object> getCanvas() {
        return canvas;
    }
}
