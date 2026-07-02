// Responsibility: Lightweight kb doc option item payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

public class KbDocOptionItemResponse {
    private final String docId;
    private final String name;
    private final String status;

    public KbDocOptionItemResponse(String docId, String name, String status) {
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
