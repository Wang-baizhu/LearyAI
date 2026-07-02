// Responsibility: Expose stable SDK API for reliable deferred usage fact recording.
package com.notebook.learyAI.module.usage.interfaces.sdk;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;

public interface UsageFactRecorder {
    void enqueueCommit(CommitUsageRequestDTO request);
}
