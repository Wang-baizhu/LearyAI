// Responsibility: Represent persisted kb skill payload used to restore task context.
package com.notebook.learyAI.module.skills.domain.model;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.List;
import java.util.Map;

public class KbSkillTokenPayload {
    private final String skillCode;
    private final List<String> abilities;
    private final String projectId;
    private final String kbId;
    private final List<Map<String, Object>> docRefs;

    @JsonCreator
    public KbSkillTokenPayload(@JsonProperty("skillCode") String skillCode,
                               @JsonProperty("abilities") List<String> abilities,
                               @JsonProperty("projectId") String projectId,
                               @JsonProperty("kbId") String kbId,
                               @JsonProperty("docRefs") List<Map<String, Object>> docRefs) {
        this.skillCode = skillCode;
        this.abilities = abilities == null ? List.of() : List.copyOf(abilities);
        this.projectId = projectId;
        this.kbId = kbId;
        this.docRefs = docRefs == null ? List.of() : List.copyOf(docRefs);
    }

    public String getSkillCode() {
        return skillCode;
    }

    public List<String> getAbilities() {
        return abilities;
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
}
