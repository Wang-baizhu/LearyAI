// Responsibility: Carry reservation state for one in-flight usage request.
package com.notebook.learyAI.module.usage.domain.model;

import java.time.Instant;

public record UsageReservation(
        String reservationId,
        String requestId,
        long userId,
        String projectId,
        String metric,
        long reservedAmount,
        String status,
        Instant expiresAt,
        Instant updatedAt
) {
}
