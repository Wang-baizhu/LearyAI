// Responsibility: Verify AccessGuardImpl enforces authz-first flow and short-circuit behavior.
package com.notebook.learyAI.module.access.application;

import com.notebook.learyAI.module.access.domain.model.AccessDecision;
import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.AuthzDecision;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.usage.domain.model.UsageAction;
import com.notebook.learyAI.module.usage.domain.model.UsageDecision;
import com.notebook.learyAI.module.usage.interfaces.facade.UsageGuard;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccessGuardImplTest {
    @Mock
    private AuthzSdk authzSdk;

    @Mock
    private UsageGuard usageGuard;

    @InjectMocks
    private AccessGuardImpl accessGuard;

    @Test
    @DisplayName("鉴权拒绝时应短路，不调用用量检查")
    void check_authzDenied_shouldShortCircuitUsage() {
        when(authzSdk.authorize(1L, "p1", Action.EDIT))
                .thenReturn(AuthzDecision.deny("PROJECT-403", "project access denied", null));

        AccessDecision decision = accessGuard.check(1L, "p1", UsageAction.DOC_UPLOAD_BYTES, 10L);

        assertFalse(decision.allowed());
        assertEquals("PROJECT-403", decision.denyCode());
        verifyNoInteractions(usageGuard);
    }

    @Test
    @DisplayName("鉴权通过后应按顺序调用用量检查并返回通过")
    void check_authzAllow_shouldCallUsageAfterAuthz() {
        when(authzSdk.authorize(1L, "p1", Action.VIEW))
                .thenReturn(AuthzDecision.allow(ProjectRole.MEMBER));
        when(usageGuard.check(1L, "p1", UsageAction.AI_CHAT_TOKENS, 5L))
                .thenReturn(UsageDecision.allow("ai_chat_tokens", 0L, -1L));

        AccessDecision decision = accessGuard.check(1L, "p1", UsageAction.AI_CHAT_TOKENS, 5L);

        assertTrue(decision.allowed());
        InOrder inOrder = inOrder(authzSdk, usageGuard);
        inOrder.verify(authzSdk).authorize(1L, "p1", Action.VIEW);
        inOrder.verify(usageGuard).check(1L, "p1", UsageAction.AI_CHAT_TOKENS, 5L);
    }

    @Test
    @DisplayName("消费路径中用量拒绝时应返回用量拒绝码")
    void checkAndConsume_usageDenied_shouldReturnUsageCode() {
        when(authzSdk.authorize(any(Long.class), any(String.class), any(Action.class)))
                .thenReturn(AuthzDecision.allow(ProjectRole.ADMIN));
        when(usageGuard.checkAndConsume(1L, "p1", UsageAction.TEMPLATE_GENERATE_COUNT, 1L, "req-1"))
                .thenReturn(UsageDecision.deny("USAGE-429", "usage consume denied", "template_generate_count", 0L, -1L));

        AccessDecision decision = accessGuard.checkAndConsume(1L, "p1", UsageAction.TEMPLATE_GENERATE_COUNT, 1L, "req-1");

        assertFalse(decision.allowed());
        assertEquals("USAGE-429", decision.denyCode());
    }
}
