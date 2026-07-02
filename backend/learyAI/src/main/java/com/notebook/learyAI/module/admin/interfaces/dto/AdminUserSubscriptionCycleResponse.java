// Responsibility: Response payload for admin-managed user subscription cycle records.
package com.notebook.learyAI.module.admin.interfaces.dto;

import java.time.Instant;

public class AdminUserSubscriptionCycleResponse {
    private final Long id;
    private final long userId;
    private final String metric;
    private final String planId;
    private final long quota;
    private final Instant validFrom;
    private final Instant validTo;
    private final String status;
    private final Instant createdAt;
    private final Instant updatedAt;

    public AdminUserSubscriptionCycleResponse(Long id,
                                              long userId,
                                              String metric,
                                              String planId,
                                              long quota,
                                              Instant validFrom,
                                              Instant validTo,
                                              String status,
                                              Instant createdAt,
                                              Instant updatedAt) {
        this.id = id;
        this.userId = userId;
        this.metric = metric;
        this.planId = planId;
        this.quota = quota;
        this.validFrom = validFrom;
        this.validTo = validTo;
        this.status = status;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public Long getId() {
        return id;
    }

    public long getUserId() {
        return userId;
    }

    public String getMetric() {
        return metric;
    }

    public String getPlanId() {
        return planId;
    }

    public long getQuota() {
        return quota;
    }

    public Instant getValidFrom() {
        return validFrom;
    }

    public Instant getValidTo() {
        return validTo;
    }

    public String getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
