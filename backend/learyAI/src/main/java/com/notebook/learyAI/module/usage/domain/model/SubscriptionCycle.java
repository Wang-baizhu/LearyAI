// Responsibility: Describe the active usage quota cycle for one user and metric.
package com.notebook.learyAI.module.usage.domain.model;

import java.time.Instant;

public record SubscriptionCycle(
        Long id,
        long userId,
        String metric,
        String planId,
        long quota,
        Instant validFrom,
        Instant validTo,
        String status,
        Instant createdAt,
        Instant updatedAt
) {
}
