// Responsibility: JPA entity mapping for kb_doc_rel table.
package com.notebook.learyAI.module.kbdoc.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
@Entity
@Table(name = "kb_doc_rel",
        uniqueConstraints = @UniqueConstraint(name = "uk_kb_doc_rel", columnNames = {"project_id", "kb_id", "doc_id"}),
        indexes = {
                @Index(name = "idx_kb_doc_rel_project_id", columnList = "project_id"),
                @Index(name = "idx_kb_doc_rel_kb_id", columnList = "kb_id"),
                @Index(name = "idx_kb_doc_rel_doc_id", columnList = "doc_id")
        })
public class KbDocRelPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false, columnDefinition = "uuid")
    private java.util.UUID projectId;

    @Column(name = "kb_id", nullable = false)
    private Long kbId;

    @Column(name = "doc_id", nullable = false)
    private Long docId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public java.util.UUID getProjectId() {
        return projectId;
    }

    public void setProjectId(java.util.UUID projectId) {
        this.projectId = projectId;
    }

    public Long getKbId() {
        return kbId;
    }

    public void setKbId(Long kbId) {
        this.kbId = kbId;
    }

    public Long getDocId() {
        return docId;
    }

    public void setDocId(Long docId) {
        this.docId = docId;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
