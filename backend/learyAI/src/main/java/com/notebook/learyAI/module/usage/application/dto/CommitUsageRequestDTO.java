// Responsibility: Carry commit-usage application input.
package com.notebook.learyAI.module.usage.application.dto;

import java.time.Instant;
import java.util.Map;

public record CommitUsageRequestDTO(
        long userId,
        String projectId,
        String metric,
        String reservationId,
        String requestId,
        long requestedAmount,
        long actualAmount,
        String idempotencyKey,
        String sourceType,
        String sourceId,
        Map<String, String> metadata,
        Instant occurredAt
) {
}
