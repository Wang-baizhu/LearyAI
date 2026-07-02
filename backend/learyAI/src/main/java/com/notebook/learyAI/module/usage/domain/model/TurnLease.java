// Responsibility: Describe one turn-scoped quota lease tracked in Redis.
package com.notebook.learyAI.module.usage.domain.model;

import java.time.Instant;

public record TurnLease(
        String leaseId,
        long userId,
        String projectId,
        String metric,
        String turnId,
        String planId,
        String status,
        Instant createdAt,
        Instant updatedAt,
        Instant expiresAt
) {
}
