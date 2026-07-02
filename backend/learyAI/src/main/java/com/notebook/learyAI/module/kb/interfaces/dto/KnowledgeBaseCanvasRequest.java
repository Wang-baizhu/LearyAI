// Responsibility: Request payload for updating a knowledge base canvas snapshot.
package com.notebook.learyAI.module.kb.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.Map;

public class KnowledgeBaseCanvasRequest {
    @Schema(additionalProperties = Schema.AdditionalPropertiesValue.TRUE)
    private Map<String, Object> canvas;

    public Map<String, Object> getCanvas() {
        return canvas;
    }

    public void setCanvas(Map<String, Object> canvas) {
        this.canvas = canvas;
    }
}
