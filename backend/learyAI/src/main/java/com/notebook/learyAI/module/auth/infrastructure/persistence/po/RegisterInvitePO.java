// Responsibility: JPA entity mapping for auth register invite table.
package com.notebook.learyAI.module.auth.infrastructure.persistence.po;

import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;

@Entity
@Table(name = "auth_register_invite",
        uniqueConstraints = @UniqueConstraint(name = "uk_auth_register_invite_code", columnNames = {"code"}),
        indexes = {
            @Index(name = "idx_auth_register_invite_status", columnList = "status"),
            @Index(name = "idx_auth_register_invite_created_at", columnList = "created_at")
        })
public class RegisterInvitePO {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String code;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private RegisterInviteStatus status;

    @Column(name = "created_by")
    private Long createdBy;

    @Column(name = "used_by_user_id")
    private Long usedByUserId;

    @Column(name = "used_at")
    private Instant usedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public RegisterInviteStatus getStatus() {
        return status;
    }

    public void setStatus(RegisterInviteStatus status) {
        this.status = status;
    }

    public Long getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(Long createdBy) {
        this.createdBy = createdBy;
    }

    public Long getUsedByUserId() {
        return usedByUserId;
    }

    public void setUsedByUserId(Long usedByUserId) {
        this.usedByUserId = usedByUserId;
    }

    public Instant getUsedAt() {
        return usedAt;
    }

    public void setUsedAt(Instant usedAt) {
        this.usedAt = usedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
