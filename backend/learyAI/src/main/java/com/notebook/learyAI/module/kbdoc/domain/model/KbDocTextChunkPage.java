// Responsibility: Carry paged text chunks for a knowledge base document.
package com.notebook.learyAI.module.kbdoc.domain.model;

import java.util.List;

public class KbDocTextChunkPage {
    private final List<KbDocTextChunk> items;
    private final boolean hasMore;
    private final Integer nextChunkSec;

    public KbDocTextChunkPage(List<KbDocTextChunk> items, boolean hasMore, Integer nextChunkSec) {
        this.items = items;
        this.hasMore = hasMore;
        this.nextChunkSec = nextChunkSec;
    }

    public List<KbDocTextChunk> getItems() {
        return items;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public Integer getNextChunkSec() {
        return nextChunkSec;
    }
}
