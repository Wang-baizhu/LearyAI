// Responsibility: Knowledge base list response payload.
package com.notebook.learyAI.module.kb.interfaces.dto;

import java.util.List;

public class KnowledgeBaseListResponse {
    private final List<KnowledgeBaseResponse> items;
    private final long total;
    private final int page;
    private final int size;

    public KnowledgeBaseListResponse(List<KnowledgeBaseResponse> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<KnowledgeBaseResponse> getItems() {
        return items;
    }

    public long getTotal() {
        return total;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }
}
