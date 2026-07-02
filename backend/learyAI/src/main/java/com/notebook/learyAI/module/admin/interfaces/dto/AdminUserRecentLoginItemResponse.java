// Responsibility: Response item payload for admin recent-login user list.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.time.Instant;

public class AdminUserRecentLoginItemResponse {
    private final long userId;
    private final String name;
    private final String email;
    private final String phone;
    private final String userMode;
    private final Instant lastLoginAt;

    public AdminUserRecentLoginItemResponse(long userId,
                                            String name,
                                            String email,
                                            String phone,
                                            String userMode,
                                            Instant lastLoginAt) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.userMode = userMode;
        this.lastLoginAt = lastLoginAt;
    }

    public long getUserId() {
        return userId;
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

    public String getUserMode() {
        return userMode;
    }

    public Instant getLastLoginAt() {
        return lastLoginAt;
    }
}
