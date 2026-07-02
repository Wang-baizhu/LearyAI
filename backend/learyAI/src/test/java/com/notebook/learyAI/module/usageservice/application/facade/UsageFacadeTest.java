// Responsibility: Verify UsageFacade assembles new usage SDK DTOs and delegates.
package com.notebook.learyAI.module.usageservice.application.facade;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.UsagePolicyMode;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageControl;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageQuery;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageRecorder;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageFacadeTest {
    @Mock
    private UsageRecorder usageRecorder;
    @Mock
    private UsageQuery usageQuery;
    @Mock
    private UsageControl usageControl;
    @InjectMocks
    private UsageFacade usageFacade;

    @Test
    @DisplayName("reserve: 应组装 DTO 后转发")
    void reserve_shouldDelegate() {
        when(usageRecorder.reserve(org.mockito.ArgumentMatchers.any(ReserveUsageRequestDTO.class)))
                .thenReturn(new ReserveUsageResponseDTO(true, true, null, null));

        usageFacade.reserve(1L, "p1", "m", "r1", "q1", 5L, 30L, Map.of("k", "v"));

        ArgumentCaptor<ReserveUsageRequestDTO> captor = ArgumentCaptor.forClass(ReserveUsageRequestDTO.class);
        verify(usageRecorder).reserve(captor.capture());
        assertEquals("r1", captor.getValue().reservationId());
    }

    @Test
    @DisplayName("commit: 应解析 occurredAt 并转发")
    void commit_shouldDelegate() {
        when(usageRecorder.commit(org.mockito.ArgumentMatchers.any(CommitUsageRequestDTO.class)))
                .thenReturn(new CommitUsageResponseDTO(true, true, null, null));

        usageFacade.commit(1L, "p1", "m", "r1", "q1", 6L, 4L, "id1", "test", "sid", Map.of(), "2026-06-19T10:00:00Z");

        ArgumentCaptor<CommitUsageRequestDTO> captor = ArgumentCaptor.forClass(CommitUsageRequestDTO.class);
        verify(usageRecorder).commit(captor.capture());
        assertEquals(Instant.parse("2026-06-19T10:00:00Z"), captor.getValue().occurredAt());
    }

    @Test
    @DisplayName("query: 应转发 current cycle 与 rolling")
    void query_shouldDelegate() {
        CurrentCycleUsage current = new CurrentCycleUsage(1L, "p1", "m", 1L, 1L, 0L, 5L, 4L, Instant.now(), Instant.now(), Instant.now());
        RollingUsage rolling = new RollingUsage(1L, "p1", "m", UsageWindowType.LAST_30_DAYS, 9L, Instant.now(), Instant.now(), Instant.now());
        when(usageQuery.getCurrentCycleUsage(1L, "p1", "m")).thenReturn(current);
        when(usageQuery.getRollingUsage(1L, "p1", "m", UsageWindowType.LAST_30_DAYS)).thenReturn(rolling);

        assertEquals(current, usageFacade.getCurrentCycleUsage(1L, "p1", "m"));
        assertEquals(rolling, usageFacade.getRollingUsage(1L, "p1", "m", "last_30_days"));
    }

    @Test
    @DisplayName("usage control: 应转发 current policy")
    void currentPolicy_shouldDelegate() {
        CurrentUsagePolicy policy = new CurrentUsagePolicy(
                1L, "p1", "m", 7L, "pro", 100L, 10L, 5L, 85L,
                UsagePolicyMode.MEMBER, Instant.now(), Instant.now(), Instant.now()
        );
        when(usageControl.getCurrentPolicy(1L, "p1", "m")).thenReturn(policy);

        assertEquals(policy, usageFacade.getCurrentPolicy(1L, "p1", "m"));
    }
}
