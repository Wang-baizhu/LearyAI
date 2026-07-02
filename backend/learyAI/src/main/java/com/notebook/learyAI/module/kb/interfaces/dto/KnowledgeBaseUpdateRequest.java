// Responsibility: Knowledge base update request payload.
package com.notebook.learyAI.module.kb.interfaces.dto;

import jakarta.validation.constraints.Size;

import java.util.List;

public class KnowledgeBaseUpdateRequest {
    @Size(max = 64)
    private String name;

    @Size(max = 512)
    private String description;

    private List<String> tags;

    @Size(max = 16)
    private String visibility;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public List<String> getTags() {
        return tags;
    }

    public void setTags(List<String> tags) {
        this.tags = tags;
    }

    public String getVisibility() {
        return visibility;
    }

    public void setVisibility(String visibility) {
        this.visibility = visibility;
    }
}
