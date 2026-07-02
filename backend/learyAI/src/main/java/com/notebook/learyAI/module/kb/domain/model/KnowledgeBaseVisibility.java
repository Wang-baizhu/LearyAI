// Responsibility: Define knowledge base visibility rules.
package com.notebook.learyAI.module.kb.domain.model;

public enum KnowledgeBaseVisibility {
    PUBLIC,
    TEAM,
    PRIVATE;

    public static KnowledgeBaseVisibility from(String value) {
        if (value == null || value.isBlank()) {
            return PRIVATE;
        }
        for (KnowledgeBaseVisibility visibility : values()) {
            if (visibility.name().equalsIgnoreCase(value.trim())) {
                return visibility;
            }
        }
        return PRIVATE;
    }
}
