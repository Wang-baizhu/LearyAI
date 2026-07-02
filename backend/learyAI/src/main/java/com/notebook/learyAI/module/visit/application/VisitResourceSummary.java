// Responsibility: Represent resource summary data used by recent visit responses.
package com.notebook.learyAI.module.visit.application;

public class VisitResourceSummary {
    private final String title;
    private final String description;
    private final String projectId;
    private final String kbId;

    public VisitResourceSummary(String title, String description, String projectId, String kbId) {
        this.title = title;
        this.description = description;
        this.projectId = projectId;
        this.kbId = kbId;
    }

    public String getTitle() {
        return title;
    }

    public String getDescription() {
        return description;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getKbId() {
        return kbId;
    }
}
