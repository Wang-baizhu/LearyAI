// Responsibility: Supported sort fields for knowledge base listing.
package com.notebook.learyAI.module.kb.domain.model;

public enum KnowledgeBaseSort {
    NAME("name"),
    VISITED_AT("visitedAt");

    private final String property;

    KnowledgeBaseSort(String property) {
        this.property = property;
    }

    public String getProperty() {
        return property;
    }

    public static KnowledgeBaseSort from(String value) {
        if (value == null || value.isBlank()) {
            return VISITED_AT;
        }
        for (KnowledgeBaseSort sort : values()) {
            if (sort.property.equalsIgnoreCase(value)) {
                return sort;
            }
        }
        return VISITED_AT;
    }
}
