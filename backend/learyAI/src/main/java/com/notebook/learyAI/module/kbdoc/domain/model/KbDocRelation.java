// Responsibility: Represent relation between knowledge base and document.
package com.notebook.learyAI.module.kbdoc.domain.model;

import java.time.Instant;

public class KbDocRelation {
    private final Long id;
    private final String projectId;
    private final Long kbId;
    private final Long docId;
    private final Instant createdAt;

    public KbDocRelation(Long id, String projectId, Long kbId, Long docId, Instant createdAt) {
        this.id = id;
        this.projectId = projectId;
        this.kbId = kbId;
        this.docId = docId;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public String getProjectId() {
        return projectId;
    }

    public Long getKbId() {
        return kbId;
    }

    public Long getDocId() {
        return docId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
