// Responsibility: Accept kb skill search parameters from HTTP requests.
package com.notebook.learyAI.module.skills.interfaces.dto;

import jakarta.validation.constraints.NotBlank;

public class KbSkillSearchRequest {
    @NotBlank
    private String token;

    @NotBlank
    private String query;

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }
}
