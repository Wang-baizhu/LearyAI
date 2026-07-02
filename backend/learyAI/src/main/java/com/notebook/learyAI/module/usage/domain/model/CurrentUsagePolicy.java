// Responsibility: Describe the current quota policy and cycle state used by usage control.
package com.notebook.learyAI.module.usage.domain.model;

import java.time.Instant;

public record CurrentUsagePolicy(
        long userId,
        String projectId,
        String metric,
        long cycleId,
        String planId,
        long quota,
        long used,
        long reserved,
        long available,
        UsagePolicyMode policyMode,
        Instant validFrom,
        Instant validTo,
        Instant updatedAt
) {
}
