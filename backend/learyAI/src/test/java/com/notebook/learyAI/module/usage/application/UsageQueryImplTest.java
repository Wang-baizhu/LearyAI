// Responsibility: Verify UsageQueryImpl delegates cycle and rolling queries to UsageAppService.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.service.UsageAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageQueryImplTest {
    @Mock
    private UsageAppService usageAppService;

    @InjectMocks
    private UsageQueryImpl usageQuery;

    @Test
    @DisplayName("getCurrentCycleUsage: 应透传参数")
    void getCurrentCycleUsage_shouldDelegate() {
        CurrentCycleUsage usage = new CurrentCycleUsage(1L, "p1", "m", 2L, 3L, 1L, 10L, 6L, Instant.now(), Instant.now(), Instant.now());
        when(usageAppService.getCurrentCycleUsage(1L, "p1", "m")).thenReturn(usage);

        assertSame(usage, usageQuery.getCurrentCycleUsage(1L, "p1", "m"));
        verify(usageAppService).getCurrentCycleUsage(1L, "p1", "m");
    }

    @Test
    @DisplayName("getRollingUsage: 应透传参数")
    void getRollingUsage_shouldDelegate() {
        RollingUsage usage = new RollingUsage(1L, "p1", "m", UsageWindowType.LAST_24_HOURS, 9L, Instant.now(), Instant.now(), Instant.now());
        when(usageAppService.getRollingUsage(1L, "p1", "m", UsageWindowType.LAST_24_HOURS)).thenReturn(usage);

        assertSame(usage, usageQuery.getRollingUsage(1L, "p1", "m", UsageWindowType.LAST_24_HOURS));
        verify(usageAppService).getRollingUsage(1L, "p1", "m", UsageWindowType.LAST_24_HOURS);
    }
}
