// Responsibility: Task list response payload.
package com.notebook.learyAI.module.task.interfaces.dto;

import java.util.List;

public class TaskListResponse {
    private final List<TaskListItemResponse> items;
    private final long total;
    private final int page;
    private final int size;

    public TaskListResponse(List<TaskListItemResponse> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<TaskListItemResponse> getItems() {
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
