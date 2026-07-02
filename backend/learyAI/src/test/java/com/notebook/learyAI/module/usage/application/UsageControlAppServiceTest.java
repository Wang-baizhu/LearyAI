// Responsibility: Verify usage-control policy fallback and single-call denial behavior.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.service.UsageAppService;
import com.notebook.learyAI.module.usage.application.service.UsageCommitOutboxAppService;
import com.notebook.learyAI.module.usage.application.service.UsageControlAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentUsagePolicy;
import com.notebook.learyAI.module.usage.domain.model.UsagePolicyMode;
import com.notebook.learyAI.module.usage.infrastructure.cache.UsageRedisStateStore;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.SubscriptionCycleJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageEventJpaRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UsageControlAppServiceTest {
    @Mock
    private UsageAppService usageAppService;
    @Mock
    private UsageCommitOutboxAppService usageCommitOutboxAppService;
    @Mock
    private SubscriptionCycleJpaRepository subscriptionCycleJpaRepository;
    @Mock
    private UsageEventJpaRepository usageEventJpaRepository;
    @Mock
    private UsageRedisStateStore usageRedisStateStore;

    private UsageControlAppService usageControlAppService;

    @BeforeEach
    void setUp() {
        usageControlAppService = new UsageControlAppService(
                usageAppService,
                usageCommitOutboxAppService,
                subscriptionCycleJpaRepository,
                usageEventJpaRepository,
                usageRedisStateStore,
                "pro,plus"
        );
    }

    @Test
    @DisplayName("getCurrentPolicy: 无活动周期时应回退 NON_MEMBER")
    void getCurrentPolicy_withoutActiveCycle_shouldFallbackToNonMember() {
        when(subscriptionCycleJpaRepository.findActiveCycle(eq(1L), eq("ai_chat_tokens"), any(Instant.class)))
                .thenReturn(Optional.empty());

        CurrentUsagePolicy policy = usageControlAppService.getCurrentPolicy(1L, "project-1", "ai_chat_tokens");

        assertEquals(UsagePolicyMode.NON_MEMBER, policy.policyMode());
        assertEquals(0L, policy.available());
        verify(usageAppService, never()).getCurrentCycleUsage(1L, "project-1", "ai_chat_tokens");
    }

    @Test
    @DisplayName("getCurrentPolicy: 空 projectId 时应按全局 scope 回退 NON_MEMBER")
    void getCurrentPolicy_withBlankProjectId_shouldAllowGlobalScope() {
        when(subscriptionCycleJpaRepository.findActiveCycle(eq(1L), eq("ai_chat_tokens"), any(Instant.class)))
                .thenReturn(Optional.empty());

        CurrentUsagePolicy policy = usageControlAppService.getCurrentPolicy(1L, "", "ai_chat_tokens");

        assertEquals(UsagePolicyMode.NON_MEMBER, policy.policyMode());
        assertEquals("", policy.projectId());
        verify(usageAppService, never()).getCurrentCycleUsage(1L, "", "ai_chat_tokens");
    }

    @Test
    @DisplayName("reserveSingleCall: 无活动周期时应抛 USAGE-403-CALL")
    void reserveSingleCall_withoutActiveCycle_shouldDeny() {
        when(subscriptionCycleJpaRepository.findActiveCycle(eq(1L), eq("ai_chat_tokens"), any(Instant.class)))
                .thenReturn(Optional.empty());

        BizException exception = assertThrows(BizException.class, () -> usageControlAppService.reserveSingleCall(
                1L,
                "project-1",
                "ai_chat_tokens",
                "reservation-1",
                "request-1",
                1L,
                60L,
                Map.of()
        ));

        assertEquals("USAGE-403-CALL", exception.getCode());
    }
}
