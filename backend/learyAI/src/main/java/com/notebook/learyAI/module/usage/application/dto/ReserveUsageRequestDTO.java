// Responsibility: Carry reserve-usage application input.
package com.notebook.learyAI.module.usage.application.dto;

import java.time.Duration;
import java.util.Map;

public record ReserveUsageRequestDTO(
        long userId,
        String projectId,
        String metric,
        String reservationId,
        String requestId,
        long requestedAmount,
        Duration reservationTtl,
        Map<String, String> metadata
) {
}
