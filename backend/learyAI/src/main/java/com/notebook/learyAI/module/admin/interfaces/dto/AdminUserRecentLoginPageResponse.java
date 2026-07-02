// Responsibility: Paginated response payload for admin recent-login users.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.util.List;

public class AdminUserRecentLoginPageResponse {
    private final int page;
    private final int size;
    private final long total;
    private final List<AdminUserRecentLoginItemResponse> items;

    public AdminUserRecentLoginPageResponse(int page,
                                            int size,
                                            long total,
                                            List<AdminUserRecentLoginItemResponse> items) {
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

    public List<AdminUserRecentLoginItemResponse> getItems() {
        return items;
    }
}
