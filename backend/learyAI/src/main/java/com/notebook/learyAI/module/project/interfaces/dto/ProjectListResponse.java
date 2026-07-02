// Responsibility: Project list response payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import java.util.List;

public class ProjectListResponse {
    private final List<ProjectResponse> items;
    private final long total;
    private final int page;
    private final int size;

    public ProjectListResponse(List<ProjectResponse> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<ProjectResponse> getItems() {
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
