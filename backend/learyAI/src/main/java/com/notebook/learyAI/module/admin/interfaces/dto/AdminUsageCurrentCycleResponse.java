// Responsibility: Response payload for admin current-cycle quota usage queries.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.time.Instant;

public class AdminUsageCurrentCycleResponse {
    private final long userId;
    private final String projectId;
    private final String metric;
    private final long cycleId;
    private final long used;
    private final long reserved;
    private final long quota;
    private final long available;
    private final Instant validFrom;
    private final Instant validTo;
    private final Instant updatedAt;

    public AdminUsageCurrentCycleResponse(long userId,
                                          String projectId,
                                          String metric,
                                          long cycleId,
                                          long used,
                                          long reserved,
                                          long quota,
                                          long available,
                                          Instant validFrom,
                                          Instant validTo,
                                          Instant updatedAt) {
        this.userId = userId;
        this.projectId = projectId;
        this.metric = metric;
        this.cycleId = cycleId;
        this.used = used;
        this.reserved = reserved;
        this.quota = quota;
        this.available = available;
        this.validFrom = validFrom;
        this.validTo = validTo;
        this.updatedAt = updatedAt;
    }

    public long getUserId() {
        return userId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getMetric() {
        return metric;
    }

    public long getCycleId() {
        return cycleId;
    }

    public long getUsed() {
        return used;
    }

    public long getReserved() {
        return reserved;
    }

    public long getQuota() {
        return quota;
    }

    public long getAvailable() {
        return available;
    }

    public Instant getValidFrom() {
        return validFrom;
    }

    public Instant getValidTo() {
        return validTo;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
