// Responsibility: Represent a persisted kb skill token row.
package com.notebook.learyAI.module.skills.domain.model;

import java.time.Instant;
import java.util.UUID;

public class KbSkillTokenRecord {
    private final Long id;
    private final UUID token;
    private final Long userId;
    private final KbSkillTokenPayload payload;
    private final Instant expiredAt;
    private final Instant createdAt;

    public KbSkillTokenRecord(Long id,
                              UUID token,
                              Long userId,
                              KbSkillTokenPayload payload,
                              Instant expiredAt,
                              Instant createdAt) {
        this.id = id;
        this.token = token;
        this.userId = userId;
        this.payload = payload;
        this.expiredAt = expiredAt;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public UUID getToken() {
        return token;
    }

    public Long getUserId() {
        return userId;
    }

    public KbSkillTokenPayload getPayload() {
        return payload;
    }

    public Instant getExpiredAt() {
        return expiredAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
