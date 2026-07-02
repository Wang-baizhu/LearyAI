// Responsibility: Paginated response payload for admin invite list.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.util.List;

public class AdminInvitePageResponse {
    private final int page;
    private final int size;
    private final long total;
    private final List<AdminInviteItemResponse> items;

    public AdminInvitePageResponse(int page, int size, long total, List<AdminInviteItemResponse> items) {
        this.page = page;
        this.size = size;
        this.total = total;
        this.items = items;
    }

    public int getPage() {
        return page;
    }

    public int getSize() {
        return size;
    }

    public long getTotal() {
        return total;
    }

    public List<AdminInviteItemResponse> getItems() {
        return items;
    }
}
