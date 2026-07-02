// Responsibility: Paginated task list.
package com.notebook.learyAI.module.task.domain.model;

import java.util.List;

public class TaskPage {
    private final List<Task> items;
    private final long total;
    private final int page;
    private final int size;

    public TaskPage(List<Task> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<Task> getItems() {
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
