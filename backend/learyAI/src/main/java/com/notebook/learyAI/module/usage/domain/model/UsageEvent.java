// Responsibility: Represent a persisted usage event as the single billing truth source.
package com.notebook.learyAI.module.usage.domain.model;

import java.time.Instant;
import java.util.Map;

public record UsageEvent(
        Long id,
        long userId,
        String projectId,
        String metric,
        long delta,
        Instant occurredAt,
        String idempotencyKey,
        String sourceType,
        String sourceId,
        Map<String, String> metadata,
        Instant createdAt
) {
}
