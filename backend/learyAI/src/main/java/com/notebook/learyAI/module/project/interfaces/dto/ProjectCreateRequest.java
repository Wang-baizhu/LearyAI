// Responsibility: Project create request payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class ProjectCreateRequest {
    @NotBlank
    @Size(max = 128)
    private String name;

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
