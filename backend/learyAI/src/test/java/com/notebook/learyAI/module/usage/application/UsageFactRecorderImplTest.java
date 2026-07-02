// Responsibility: Verify UsageFactRecorderImpl delegates enqueueCommit to usage commit outbox service.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.service.UsageCommitOutboxAppService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UsageFactRecorderImplTest {
    @Mock
    private UsageCommitOutboxAppService usageCommitOutboxAppService;

    @InjectMocks
    private UsageFactRecorderImpl usageFactRecorder;

    @Test
    @DisplayName("enqueueCommit: 应透传到 usage commit outbox")
    void enqueueCommit_shouldDelegate() {
        CommitUsageRequestDTO request = new CommitUsageRequestDTO(
                1L,
                "p1",
                "kbdoc_size",
                "r1",
                "q1",
                10L,
                10L,
                "id1",
                "kbdoc_confirm_upload",
                "doc-1",
                Map.of("docId", "doc-1"),
                Instant.now()
        );

        usageFactRecorder.enqueueCommit(request);

        verify(usageCommitOutboxAppService).enqueueCommit(request);
    }
}
