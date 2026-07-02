// Responsibility: Serialize paged recent visit responses.
package com.notebook.learyAI.module.visit.interfaces.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.List;

public class RecentVisitPageResponse {
    private final List<RecentVisitItemResponse> items;
    private final boolean hasMore;
    @Schema(nullable = true)
    private final String nextCursor;

    public RecentVisitPageResponse(List<RecentVisitItemResponse> items, boolean hasMore, String nextCursor) {
        this.items = items;
        this.hasMore = hasMore;
        this.nextCursor = nextCursor;
    }

    public List<RecentVisitItemResponse> getItems() {
        return items;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    @Schema(nullable = true)
    public String getNextCursor() {
        return nextCursor;
    }
}
