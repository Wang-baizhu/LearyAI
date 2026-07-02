// Responsibility: Accept kb skill token issuance parameters from HTTP requests.
package com.notebook.learyAI.module.skills.interfaces.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.Valid;

import java.util.List;

public class KbSkillTokenCreateRequest {
    @NotBlank
    private String projectId;

    @NotBlank
    private String kbId;

    @Valid
    private List<KbSkillDocRefRequest> docRefs;

    @NotEmpty
    private List<String> abilities;

    private Integer expiresInDays;

    private Boolean neverExpires;

    private Integer expiresInSeconds;

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getKbId() {
        return kbId;
    }

    public void setKbId(String kbId) {
        this.kbId = kbId;
    }

    public List<KbSkillDocRefRequest> getDocRefs() {
        return docRefs;
    }

    public void setDocRefs(List<KbSkillDocRefRequest> docRefs) {
        this.docRefs = docRefs;
    }

    public List<String> getAbilities() {
        return abilities;
    }

    public void setAbilities(List<String> abilities) {
        this.abilities = abilities;
    }

    public Integer getExpiresInDays() {
        return expiresInDays;
    }

    public void setExpiresInDays(Integer expiresInDays) {
        this.expiresInDays = expiresInDays;
    }

    public Boolean getNeverExpires() {
        return neverExpires;
    }

    public void setNeverExpires(Boolean neverExpires) {
        this.neverExpires = neverExpires;
    }

    public Integer getExpiresInSeconds() {
        return expiresInSeconds;
    }

    public void setExpiresInSeconds(Integer expiresInSeconds) {
        this.expiresInSeconds = expiresInSeconds;
    }
}
