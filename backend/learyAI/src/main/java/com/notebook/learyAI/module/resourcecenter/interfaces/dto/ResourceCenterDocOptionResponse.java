// Responsibility: Lightweight document option payload for resource center aggregate queries.
package com.notebook.learyAI.module.resourcecenter.interfaces.dto;

public class ResourceCenterDocOptionResponse {
    private final String docId;
    private final String name;
    private final String status;

    public ResourceCenterDocOptionResponse(String docId, String name, String status) {
        this.docId = docId;
        this.name = name;
        this.status = status;
    }

    public String getDocId() {
        return docId;
    }

    public String getName() {
        return name;
    }

    public String getStatus() {
        return status;
    }
}
