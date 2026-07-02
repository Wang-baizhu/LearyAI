// Responsibility: Represent a completed knowledge base document.
package com.notebook.learyAI.module.kbdoc.domain.model;

import java.time.Instant;
import java.util.Map;

public class KbDoc {
    private final Long id;
    private final String projectId;
    private final String docId;
    private final String name;
    private final String fileType;
    private final Long size;
    private final String objectKey;
    private final String storageProvider;
    private final String originUrl;
    private final Map<String, Object> metadata;
    private final String status;
    private final Instant createdAt;
    private final Instant updatedAt;

    public KbDoc(Long id, String projectId, String docId, String name, String fileType, Long size,
                 String objectKey, String storageProvider, String originUrl, Map<String, Object> metadata, String status,
                 Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.projectId = projectId;
        this.docId = docId;
        this.name = name;
        this.fileType = fileType;
        this.size = size;
        this.objectKey = objectKey;
        this.storageProvider = storageProvider;
        this.originUrl = originUrl;
        this.metadata = metadata;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getDocId() {
        return docId;
    }

    public String getName() {
        return name;
    }

    public String getFileType() {
        return fileType;
    }

    public Long getSize() {
        return size;
    }

    public String getObjectKey() {
        return objectKey;
    }

    public String getStorageProvider() {
        return storageProvider;
    }

    public String getOriginUrl() {
        return originUrl;
    }

    public Map<String, Object> getMetadata() {
        return metadata;
    }

    public String getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
