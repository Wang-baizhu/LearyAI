// Responsibility: Carry commit-usage application output.
package com.notebook.learyAI.module.usage.application.dto;

import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageEvent;

public record CommitUsageResponseDTO(
        boolean success,
        boolean applied,
        UsageEvent event,
        CurrentCycleUsage currentCycle
) {
}
