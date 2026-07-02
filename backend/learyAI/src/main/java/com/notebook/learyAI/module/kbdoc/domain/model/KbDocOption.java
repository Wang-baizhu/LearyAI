// Responsibility: Lightweight kb doc option for selectors.
package com.notebook.learyAI.module.kbdoc.domain.model;

public class KbDocOption {
    private final String docId;
    private final String name;
    private final String status;

    public KbDocOption(String docId, String name, String status) {
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
