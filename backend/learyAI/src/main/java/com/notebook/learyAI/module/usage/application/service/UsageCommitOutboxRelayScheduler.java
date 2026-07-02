// Responsibility: Periodically relay pending usage commit outbox records.
package com.notebook.learyAI.module.usage.application.service;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class UsageCommitOutboxRelayScheduler {
    private final UsageCommitOutboxAppService usageCommitOutboxAppService;

    public UsageCommitOutboxRelayScheduler(UsageCommitOutboxAppService usageCommitOutboxAppService) {
        this.usageCommitOutboxAppService = usageCommitOutboxAppService;
    }

    @Scheduled(fixedDelayString = "${usage.commit-outbox.relay-fixed-delay-ms:1000}")
    public void relayPendingRecords() {
        usageCommitOutboxAppService.relayReadyBatch();
    }
}
