// Responsibility: Knowledge base document detail response payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import java.time.Instant;
import java.util.Map;

public class KbDocDetailResponse {
    private final String docId;
    private final String name;
    private final String fileType;
    private final Long size;
    private final String objectKey;
    private final String storageProvider;
    private final String originUrl;
    private final Map<String, Object> metadata;
    private final Instant createdAt;
    private final Instant updatedAt;

    public KbDocDetailResponse(String docId, String name, String fileType, Long size,
                               String objectKey, String storageProvider, String originUrl, Map<String, Object> metadata,
                               Instant createdAt, Instant updatedAt) {
        this.docId = docId;
        this.name = name;
        this.fileType = fileType;
        this.size = size;
        this.objectKey = objectKey;
        this.storageProvider = storageProvider;
        this.originUrl = originUrl;
        this.metadata = metadata;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
