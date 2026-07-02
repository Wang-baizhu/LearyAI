// Responsibility: Verify UsageRecorderImpl delegates reserve/commit/release to UsageAppService.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.service.UsageAppService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageRecorderImplTest {
    @Mock
    private UsageAppService usageAppService;

    @InjectMocks
    private UsageRecorderImpl usageRecorder;

    @Test
    @DisplayName("reserve: 应透传请求")
    void reserve_shouldDelegate() {
        ReserveUsageRequestDTO request = new ReserveUsageRequestDTO(1L, "p1", "m", "r1", "q1", 10L, Duration.ofMinutes(1), Map.of());
        ReserveUsageResponseDTO response = new ReserveUsageResponseDTO(true, true, null, null);
        when(usageAppService.reserve(request)).thenReturn(response);

        assertSame(response, usageRecorder.reserve(request));
        verify(usageAppService).reserve(request);
    }

    @Test
    @DisplayName("commit: 应透传请求")
    void commit_shouldDelegate() {
        CommitUsageRequestDTO request = new CommitUsageRequestDTO(1L, "p1", "m", "r1", "q1", 10L, 8L, "id1", "test", "sid", Map.of(), Instant.now());
        CommitUsageResponseDTO response = new CommitUsageResponseDTO(true, true, null, null);
        when(usageAppService.commit(request)).thenReturn(response);

        assertSame(response, usageRecorder.commit(request));
        verify(usageAppService).commit(request);
    }

    @Test
    @DisplayName("release: 应透传请求")
    void release_shouldDelegate() {
        ReleaseUsageRequestDTO request = new ReleaseUsageRequestDTO(1L, "p1", "m", "r1", "q1");
        ReleaseUsageResponseDTO response = new ReleaseUsageResponseDTO(true, true, null);
        when(usageAppService.release(request)).thenReturn(response);

        assertSame(response, usageRecorder.release(request));
        verify(usageAppService).release(request);
    }
}
