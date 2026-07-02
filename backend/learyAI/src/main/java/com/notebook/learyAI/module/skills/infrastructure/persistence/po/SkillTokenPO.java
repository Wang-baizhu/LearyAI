// Responsibility: JPA entity mapping for persisted external skill tokens.
package com.notebook.learyAI.module.skills.infrastructure.persistence.po;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "skill_token",
        indexes = {
                @Index(name = "idx_skill_token_user_id", columnList = "user_id"),
                @Index(name = "idx_skill_token_expired_at", columnList = "expired_at")
        })
public class SkillTokenPO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "token", nullable = false, columnDefinition = "uuid")
    private UUID token;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "payload", nullable = false, columnDefinition = "text")
    private String payload;

    @Column(name = "expired_at")
    private Instant expiredAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UUID getToken() {
        return token;
    }

    public void setToken(UUID token) {
        this.token = token;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getPayload() {
        return payload;
    }

    public void setPayload(String payload) {
        this.payload = payload;
    }

    public Instant getExpiredAt() {
        return expiredAt;
    }

    public void setExpiredAt(Instant expiredAt) {
        this.expiredAt = expiredAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
