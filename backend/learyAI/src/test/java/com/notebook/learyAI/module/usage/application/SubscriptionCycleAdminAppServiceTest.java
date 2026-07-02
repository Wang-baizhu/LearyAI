// Responsibility: Verify subscription cycle admin service validation and repository interaction.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.UpsertSubscriptionCycleRequestDTO;
import com.notebook.learyAI.module.usage.application.service.SubscriptionCycleAdminAppService;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.SubscriptionCycleJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.SubscriptionCyclePO;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SubscriptionCycleAdminAppServiceTest {
    @Mock
    private SubscriptionCycleJpaRepository subscriptionCycleJpaRepository;

    @InjectMocks
    private SubscriptionCycleAdminAppService appService;

    @Test
    @DisplayName("非法时间范围时应抛 USAGE-400")
    void upsertCycle_invalidRange_shouldThrow() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.upsertCycle(new UpsertSubscriptionCycleRequestDTO(
                        1L, "ai_chat_tokens", "pro", 100L,
                        Instant.parse("2026-07-19T00:00:00Z"),
                        Instant.parse("2026-06-19T00:00:00Z")
                )));
        assertEquals("USAGE-400", ex.getCode());
    }

    @Test
    @DisplayName("upsertCycle: 应关闭旧 ACTIVE 并保存新周期")
    void upsertCycle_shouldDeactivateOldActiveAndSaveNewOne() {
        SubscriptionCyclePO active = new SubscriptionCyclePO();
        active.setId(1L);
        active.setUserId(1L);
        active.setMetric("ai_chat_tokens");
        active.setPlanId("old");
        active.setQuota(10L);
        active.setValidFrom(Instant.parse("2026-06-01T00:00:00Z"));
        active.setValidTo(Instant.parse("2026-07-01T00:00:00Z"));
        active.setStatus("ACTIVE");
        active.setCreatedAt(Instant.parse("2026-06-01T00:00:00Z"));
        active.setUpdatedAt(Instant.parse("2026-06-01T00:00:00Z"));
        when(subscriptionCycleJpaRepository.findActiveCyclesForUpdate(1L, "ai_chat_tokens")).thenReturn(List.of(active));
        when(subscriptionCycleJpaRepository.save(org.mockito.ArgumentMatchers.any(SubscriptionCyclePO.class)))
                .thenAnswer(invocation -> {
                    SubscriptionCyclePO po = invocation.getArgument(0);
                    po.setId(2L);
                    return po;
                });

        appService.upsertCycle(new UpsertSubscriptionCycleRequestDTO(
                1L, "ai_chat_tokens", "pro", 100L,
                Instant.parse("2026-06-19T00:00:00Z"),
                Instant.parse("2026-07-19T00:00:00Z")
        ));

        assertEquals("INACTIVE", active.getStatus());
        ArgumentCaptor<SubscriptionCyclePO> captor = ArgumentCaptor.forClass(SubscriptionCyclePO.class);
        verify(subscriptionCycleJpaRepository).save(captor.capture());
        assertEquals("ACTIVE", captor.getValue().getStatus());
        assertEquals("pro", captor.getValue().getPlanId());
    }
}
