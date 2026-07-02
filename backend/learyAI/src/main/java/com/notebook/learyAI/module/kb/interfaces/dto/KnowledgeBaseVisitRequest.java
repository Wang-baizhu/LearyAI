// Responsibility: Knowledge base visit request payload.
package com.notebook.learyAI.module.kb.interfaces.dto;

import java.time.Instant;

public class KnowledgeBaseVisitRequest {
    private Instant visitedAt;

    public Instant getVisitedAt() {
        return visitedAt;
    }

    public void setVisitedAt(Instant visitedAt) {
        this.visitedAt = visitedAt;
    }
}
