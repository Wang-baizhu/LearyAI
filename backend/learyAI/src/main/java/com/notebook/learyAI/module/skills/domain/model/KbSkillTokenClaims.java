// Responsibility: Represent the signed claims for external kb skill access.
package com.notebook.learyAI.module.skills.domain.model;

import java.time.Instant;
import java.util.List;

public class KbSkillTokenClaims {
    private final String tokenId;
    private final String projectId;
    private final String kbId;
    private final Long userId;
    private final List<String> docIds;
    private final List<String> abilities;
    private final Instant issuedAt;
    private final Instant expiresAt;
    private final String issuer;

    public KbSkillTokenClaims(String tokenId,
                              String projectId,
                              String kbId,
                              Long userId,
                              List<String> docIds,
                              List<String> abilities,
                              Instant issuedAt,
                              Instant expiresAt,
                              String issuer) {
        this.tokenId = tokenId;
        this.projectId = projectId;
        this.kbId = kbId;
        this.userId = userId;
        this.docIds = docIds == null ? List.of() : List.copyOf(docIds);
        this.abilities = abilities == null ? List.of() : List.copyOf(abilities);
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
        this.issuer = issuer;
    }

    public String getTokenId() {
        return tokenId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getKbId() {
        return kbId;
    }

    public Long getUserId() {
        return userId;
    }

    public List<String> getDocIds() {
        return docIds;
    }

    public List<String> getAbilities() {
        return abilities;
    }

    public Instant getIssuedAt() {
        return issuedAt;
    }

    public Instant getExpiresAt() {
        return expiresAt;
    }

    public String getIssuer() {
        return issuer;
    }
}
