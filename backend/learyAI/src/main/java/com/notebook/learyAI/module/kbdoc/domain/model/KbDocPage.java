// Responsibility: Paginated knowledge base documents.
package com.notebook.learyAI.module.kbdoc.domain.model;

import java.util.List;

public class KbDocPage {
    private final List<KbDoc> items;
    private final long total;
    private final int page;
    private final int size;

    public KbDocPage(List<KbDoc> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<KbDoc> getItems() {
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
