// Responsibility: Carry usage totals for one rolling time window query.
package com.notebook.learyAI.module.usage.domain.model;

import java.time.Instant;

public record RollingUsage(
        long userId,
        String projectId,
        String metric,
        UsageWindowType windowType,
        long used,
        Instant windowStart,
        Instant windowEnd,
        Instant updatedAt
) {
}
