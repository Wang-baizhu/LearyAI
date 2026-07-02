// Responsibility: Knowledge base document list response payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import java.util.List;

public class KbDocListResponse {
    private final List<KbDocItemResponse> items;
    private final long total;
    private final int page;
    private final int size;

    public KbDocListResponse(List<KbDocItemResponse> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<KbDocItemResponse> getItems() {
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
