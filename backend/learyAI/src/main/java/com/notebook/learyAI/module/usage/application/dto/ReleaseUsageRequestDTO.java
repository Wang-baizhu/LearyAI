// Responsibility: Carry release-usage application input.
package com.notebook.learyAI.module.usage.application.dto;

public record ReleaseUsageRequestDTO(
        long userId,
        String projectId,
        String metric,
        String reservationId,
        String requestId
) {
}
