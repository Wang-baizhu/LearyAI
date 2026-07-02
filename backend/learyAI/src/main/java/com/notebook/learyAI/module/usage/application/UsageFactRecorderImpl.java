// Responsibility: Implement UsageFactRecorder by delegating to usage commit outbox service.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.service.UsageCommitOutboxAppService;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageFactRecorder;
import org.springframework.stereotype.Service;

@Service
public class UsageFactRecorderImpl implements UsageFactRecorder {
    private final UsageCommitOutboxAppService usageCommitOutboxAppService;

    public UsageFactRecorderImpl(UsageCommitOutboxAppService usageCommitOutboxAppService) {
        this.usageCommitOutboxAppService = usageCommitOutboxAppService;
    }

    @Override
    public void enqueueCommit(CommitUsageRequestDTO request) {
        usageCommitOutboxAppService.enqueueCommit(request);
    }
}
