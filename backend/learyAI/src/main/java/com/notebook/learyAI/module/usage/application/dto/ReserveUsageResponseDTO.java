// Responsibility: Carry reserve-usage application output.
package com.notebook.learyAI.module.usage.application.dto;

import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageReservation;

public record ReserveUsageResponseDTO(
        boolean success,
        boolean reserved,
        UsageReservation reservation,
        CurrentCycleUsage currentCycle
) {
}
