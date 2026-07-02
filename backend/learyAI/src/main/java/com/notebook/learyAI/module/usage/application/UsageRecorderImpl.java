// Responsibility: Implement UsageRecorder by delegating to usage application service.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.service.UsageAppService;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageRecorder;
import org.springframework.stereotype.Service;

@Service
public class UsageRecorderImpl implements UsageRecorder {
    private final UsageAppService usageAppService;

    public UsageRecorderImpl(UsageAppService usageAppService) {
        this.usageAppService = usageAppService;
    }

    @Override
    public ReserveUsageResponseDTO reserve(ReserveUsageRequestDTO request) {
        return usageAppService.reserve(request);
    }

    @Override
    public CommitUsageResponseDTO commit(CommitUsageRequestDTO request) {
        return usageAppService.commit(request);
    }

    @Override
    public ReleaseUsageResponseDTO release(ReleaseUsageRequestDTO request) {
        return usageAppService.release(request);
    }
}
