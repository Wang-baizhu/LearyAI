// Responsibility: JPA entity mapping for kb_doc table.
package com.notebook.learyAI.module.kbdoc.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;

@Entity
@Table(name = "kb_doc",
        uniqueConstraints = @UniqueConstraint(name = "uk_doc_project_id", columnNames = {"project_id", "doc_id"}),
        indexes = {
                @Index(name = "idx_kb_doc_project_id", columnList = "project_id"),
                @Index(name = "idx_kb_doc_created_at", columnList = "created_at")
        })
public class KbDocPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false, columnDefinition = "uuid")
    private java.util.UUID projectId;

    @Column(name = "doc_id", nullable = false, length = 64)
    private String docId;

    @Column(nullable = false, length = 255)
    private String name;

    @Column(name = "file_type", nullable = false, length = 32)
    private String fileType;

    @Column(nullable = false)
    private Long size;

    @Column(name = "storage_provider", nullable = false, length = 32)
    private String storageProvider;

    @Column(length = 32)
    private String status;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    private String identity;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "json")
    private String metadata;

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

    public String getDocId() {
        return docId;
    }

    public void setDocId(String docId) {
        this.docId = docId;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getFileType() {
        return fileType;
    }

    public void setFileType(String fileType) {
        this.fileType = fileType;
    }

    public Long getSize() {
        return size;
    }

    public void setSize(Long size) {
        this.size = size;
    }

    public String getStorageProvider() {
        return storageProvider;
    }

    public void setStorageProvider(String storageProvider) {
        this.storageProvider = storageProvider;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getIdentity() {
        return identity;
    }

    public void setIdentity(String identity) {
        this.identity = identity;
    }

    public String getMetadata() {
        return metadata;
    }

    public void setMetadata(String metadata) {
        this.metadata = metadata;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
