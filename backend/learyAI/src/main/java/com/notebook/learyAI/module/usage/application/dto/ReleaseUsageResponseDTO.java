// Responsibility: Carry release-usage application output.
package com.notebook.learyAI.module.usage.application.dto;

import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;

public record ReleaseUsageResponseDTO(
        boolean success,
        boolean released,
        CurrentCycleUsage currentCycle
) {
}
