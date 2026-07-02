// Responsibility: Carry current-cycle quota usage including reservation state.
package com.notebook.learyAI.module.usage.domain.model;

import java.time.Instant;

public record CurrentCycleUsage(
        long userId,
        String projectId,
        String metric,
        long cycleId,
        long used,
        long reserved,
        long quota,
        long available,
        Instant validFrom,
        Instant validTo,
        Instant updatedAt
) {
}
