// Responsibility: Response payload for admin user summary metrics.
package com.notebook.learyAI.module.admin.interfaces.dto;

public class AdminUserSummaryResponse {
    private final long totalUsers;

    public AdminUserSummaryResponse(long totalUsers) {
        this.totalUsers = totalUsers;
    }

    public long getTotalUsers() {
        return totalUsers;
    }
}
