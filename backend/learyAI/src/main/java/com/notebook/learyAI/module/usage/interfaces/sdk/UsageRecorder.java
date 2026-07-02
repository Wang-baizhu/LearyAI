// Responsibility: Expose stable SDK API for usage reservation and settlement.
package com.notebook.learyAI.module.usage.interfaces.sdk;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;

public interface UsageRecorder {
    ReserveUsageResponseDTO reserve(ReserveUsageRequestDTO request);

    CommitUsageResponseDTO commit(CommitUsageRequestDTO request);

    ReleaseUsageResponseDTO release(ReleaseUsageRequestDTO request);
}
