// Responsibility: Verify UsageGuardAdapter checks current-cycle quota and immediate commit flow.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageAction;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageQuery;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageRecorder;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageGuardAdapterTest {
    @Mock
    private UsageRecorder usageRecorder;
    @Mock
    private UsageQuery usageQuery;
    @InjectMocks
    private UsageGuardAdapter usageGuard;

    @Test
    @DisplayName("delta 非正数时应抛 USAGE-400")
    void check_invalidDelta_shouldThrow() {
        BizException ex = assertThrows(BizException.class,
                () -> usageGuard.check(1L, "p1", UsageAction.AI_CHAT_TOKENS, 0L));
        assertEquals("USAGE-400", ex.getCode());
    }

    @Test
    @DisplayName("余额不足时应拒绝")
    void check_quotaExceeded_shouldDeny() {
        when(usageQuery.getCurrentCycleUsage(1L, "p1", "doc_upload_bytes"))
                .thenReturn(new CurrentCycleUsage(1L, "p1", "doc_upload_bytes", 1L, 8L, 1L, 10L, 1L, Instant.now(), Instant.now(), Instant.now()));

        UsageDecision decision = usageGuard.check(1L, "p1", UsageAction.DOC_UPLOAD_BYTES, 3L);

        assertFalse(decision.allowed());
        assertEquals("USAGE-403", decision.denyCode());
    }

    @Test
    @DisplayName("checkAndConsume: 应先 reserve 再 commit")
    void checkAndConsume_shouldReserveAndCommit() {
        when(usageRecorder.reserve(any(ReserveUsageRequestDTO.class)))
                .thenReturn(new ReserveUsageResponseDTO(true, true, null, null));
        when(usageRecorder.commit(any(CommitUsageRequestDTO.class)))
                .thenReturn(new CommitUsageResponseDTO(true, true, null,
                        new CurrentCycleUsage(1L, "p1", "template_generate_count", 1L, 5L, 0L, 10L, 5L, Instant.now(), Instant.now(), Instant.now())));

        UsageDecision decision = usageGuard.checkAndConsume(1L, "p1", UsageAction.TEMPLATE_GENERATE_COUNT, 2L, "req-1");

        assertTrue(decision.allowed());
        ArgumentCaptor<ReserveUsageRequestDTO> reserveCaptor = ArgumentCaptor.forClass(ReserveUsageRequestDTO.class);
        ArgumentCaptor<CommitUsageRequestDTO> commitCaptor = ArgumentCaptor.forClass(CommitUsageRequestDTO.class);
        verify(usageRecorder).reserve(reserveCaptor.capture());
        verify(usageRecorder).commit(commitCaptor.capture());
        assertEquals("guard:req-1", reserveCaptor.getValue().reservationId());
        assertEquals("guard:req-1:template_generate_count", commitCaptor.getValue().idempotencyKey());
    }

    @Test
    @DisplayName("空 projectId 时应归一为全局 scope")
    void check_withBlankProjectId_shouldNormalizeToEmptyScope() {
        when(usageQuery.getCurrentCycleUsage(1L, "", "doc_upload_bytes"))
                .thenReturn(new CurrentCycleUsage(1L, "", "doc_upload_bytes", 1L, 1L, 0L, 10L, 9L, Instant.now(), Instant.now(), Instant.now()));

        UsageDecision decision = usageGuard.check(1L, "", UsageAction.DOC_UPLOAD_BYTES, 3L);

        assertTrue(decision.allowed());
        verify(usageQuery).getCurrentCycleUsage(eq(1L), eq(""), eq("doc_upload_bytes"));
    }
}
