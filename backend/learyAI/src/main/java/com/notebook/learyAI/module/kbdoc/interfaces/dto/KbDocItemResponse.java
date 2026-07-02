// Responsibility: Knowledge base document list item payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import java.time.Instant;

public class KbDocItemResponse {
    private final String docId;
    private final String name;
    private final String fileType;
    private final Long size;
    private final Instant createdAt;
    private final String status;

    public KbDocItemResponse(String docId, String name, String fileType,
                             Long size, Instant createdAt, String status) {
        this.docId = docId;
        this.name = name;
        this.fileType = fileType;
        this.size = size;
        this.createdAt = createdAt;
        this.status = status;
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

    public Instant getCreatedAt() {
        return createdAt;
    }

    public String getStatus() {
        return status;
    }
}
