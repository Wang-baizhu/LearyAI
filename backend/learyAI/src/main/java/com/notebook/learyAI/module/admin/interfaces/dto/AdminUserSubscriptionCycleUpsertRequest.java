// Responsibility: Request payload for admin-managed user subscription cycle updates.
package com.notebook.learyAI.module.admin.interfaces.dto;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.Instant;

public class AdminUserSubscriptionCycleUpsertRequest {
    @NotBlank
    private String planId;

    @NotNull
    @Min(0)
    private Long quota;

    @NotNull
    private Instant validFrom;

    @NotNull
    private Instant validTo;

    public String getPlanId() {
        return planId;
    }

    public void setPlanId(String planId) {
        this.planId = planId;
    }

    public Long getQuota() {
        return quota;
    }

    public void setQuota(Long quota) {
        this.quota = quota;
    }

    public Instant getValidFrom() {
        return validFrom;
    }

    public void setValidFrom(Instant validFrom) {
        this.validFrom = validFrom;
    }

    public Instant getValidTo() {
        return validTo;
    }

    public void setValidTo(Instant validTo) {
        this.validTo = validTo;
    }
}
