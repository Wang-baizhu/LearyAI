// Responsibility: Knowledge base document text chunk page payload.
package com.notebook.learyAI.module.kbdoc.interfaces.dto;

import java.util.List;

public class KbDocTextChunkPageResponse {
    private final List<KbDocTextChunkItemResponse> items;
    private final boolean hasMore;
    private final Integer nextChunkSec;

    public KbDocTextChunkPageResponse(List<KbDocTextChunkItemResponse> items, boolean hasMore, Integer nextChunkSec) {
        this.items = items;
        this.hasMore = hasMore;
        this.nextChunkSec = nextChunkSec;
    }

    public List<KbDocTextChunkItemResponse> getItems() {
        return items;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public Integer getNextChunkSec() {
        return nextChunkSec;
    }
}
