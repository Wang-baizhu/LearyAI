// Responsibility: Auth domain user entity.
package com.notebook.learyAI.module.auth.domain.model;

import java.time.Instant;

public class User {
    private final Long id;
    private final String name;
    private final String email;
    private final String phone;
    private final String passwordHash;
    private final UserStatus status;
    private final UserMode userMode;
    private final Instant createdAt;
    private final Instant lastLoginAt;

    public User(Long id, String name, String email, String phone, String passwordHash, UserStatus status, UserMode userMode,
                Instant createdAt, Instant lastLoginAt) {
        this.id = id;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.passwordHash = passwordHash;
        this.status = status;
        this.userMode = userMode;
        this.createdAt = createdAt;
        this.lastLoginAt = lastLoginAt;
    }

    public User withLastLoginAt(Instant lastLoginAt) {
        return new User(this.id, this.name, this.email, this.phone, this.passwordHash, this.status, this.userMode,
                this.createdAt, lastLoginAt);
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getEmail() {
        return email;
    }

    public String getPhone() {
        return phone;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public UserStatus getStatus() {
        return status;
    }

    public UserMode getUserMode() {
        return userMode;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }
}
