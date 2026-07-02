// Responsibility: Carry user summary for auth responses.
package com.notebook.learyAI.module.auth.application;

public class AuthUserSummary {
    private final Long userId;
    private final String name;
    private final String email;
    private final String phone;
    private final String userMode;

    public AuthUserSummary(Long userId, String name, String email, String phone, String userMode) {
        this.userId = userId;
        this.name = name;
        this.email = email;
        this.phone = phone;
        this.userMode = userMode;
    }

    public Long getUserId() {
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
}
