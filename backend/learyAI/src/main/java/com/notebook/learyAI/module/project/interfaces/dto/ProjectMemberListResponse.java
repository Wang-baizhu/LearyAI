// Responsibility: Project member list response payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import java.util.List;

public class ProjectMemberListResponse {
    private final List<ProjectMemberResponse> items;
    private final long total;
    private final int page;
    private final int size;

    public ProjectMemberListResponse(List<ProjectMemberResponse> items, long total, int page, int size) {
        this.items = items;
        this.total = total;
        this.page = page;
        this.size = size;
    }

    public List<ProjectMemberResponse> getItems() {
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
