// Responsibility: Trigger the daily kb doc storage usage correction entrypoint.
package com.notebook.learyAI.module.kbdoc.application;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

@Service
public class KbDocStorageUsageCorrectionScheduler {
    private final KbDocStorageUsageAppService kbDocStorageUsageAppService;

    public KbDocStorageUsageCorrectionScheduler(KbDocStorageUsageAppService kbDocStorageUsageAppService) {
        this.kbDocStorageUsageAppService = kbDocStorageUsageAppService;
    }

    @Scheduled(cron = "${kb.doc.usage.correction-cron:0 30 3 * * ?}")
    public void correctDailyUsage() {
        kbDocStorageUsageAppService.runDailyCorrectionPlaceholder();
    }
}
