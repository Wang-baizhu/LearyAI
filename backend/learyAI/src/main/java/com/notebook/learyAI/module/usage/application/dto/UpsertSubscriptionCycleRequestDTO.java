// Responsibility: Carry admin-managed subscription cycle upsert input.
package com.notebook.learyAI.module.usage.application.dto;

import java.time.Instant;

public record UpsertSubscriptionCycleRequestDTO(
        long userId,
        String metric,
        String planId,
        long quota,
        Instant validFrom,
        Instant validTo
) {
}
