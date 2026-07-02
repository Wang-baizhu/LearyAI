// Responsibility: Paginated response payload for admin task DLQ incident list.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.util.List;

public class AdminTaskDlqIncidentPageResponse {
    private final int page;
    private final int size;
    private final long total;
    private final List<AdminTaskDlqIncidentItemResponse> items;

    public AdminTaskDlqIncidentPageResponse(int page,
                                            int size,
                                            long total,
                                            List<AdminTaskDlqIncidentItemResponse> items) {
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

    public List<AdminTaskDlqIncidentItemResponse> getItems() {
        return items;
    }
}
