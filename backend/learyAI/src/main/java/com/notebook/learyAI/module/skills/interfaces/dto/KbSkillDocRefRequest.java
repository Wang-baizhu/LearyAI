// Responsibility: Carry caller-provided kb doc reference snapshot for token issuance.
package com.notebook.learyAI.module.skills.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

public class KbSkillDocRefRequest {
    @NotBlank
    private String id;

    @NotBlank
    private String name;

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }
}
