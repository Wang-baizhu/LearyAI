// Responsibility: Return issued kb skill token and claim summary to clients.
package com.notebook.learyAI.module.skills.interfaces.dto;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public class KbSkillTokenResponse {
    private final String token;
    private final String projectId;
    private final String kbId;
    private final List<Map<String, Object>> docRefs;
    private final List<String> abilities;
    private final Instant expiresAt;

    public KbSkillTokenResponse(String token,
                                String projectId,
                                String kbId,
                                List<Map<String, Object>> docRefs,
                                List<String> abilities,
                                Instant expiresAt) {
        this.token = token;
        this.projectId = projectId;
        this.kbId = kbId;
        this.docRefs = docRefs == null ? List.of() : List.copyOf(docRefs);
        this.abilities = abilities == null ? List.of() : List.copyOf(abilities);
        this.expiresAt = expiresAt;
    }

    public String getToken() {
        return token;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getKbId() {
        return kbId;
    }

    public List<Map<String, Object>> getDocRefs() {
        return docRefs;
    }

    public List<String> getAbilities() {
        return abilities;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }
}
