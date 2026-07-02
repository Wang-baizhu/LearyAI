// Responsibility: Verify AuthzSdkImpl decision codes and role checks.
package com.notebook.learyAI.module.authz.application;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.application.cache.CachedValue;
import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.AuthzDecision;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthzSdkImplTest {
    @Mock
    private MembershipQueryRepository membershipQueryRepository;

    @Mock
    private AuthzPolicyService authzPolicyService;

    private AuthzSdkImpl authzSdk;

    @BeforeEach
    void setUp() {
        authzSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, new NoopAuthzQueryCache());
    }

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("requireUserId 在上下文无用户时应抛出 UNAUTHORIZED")
    void requireUserId_noContext_shouldThrowUnauthorized() {
        CurrentUserContext.clear();
        BizException ex = assertThrows(BizException.class, () -> authzSdk.requireUserId());
        assertEquals("UNAUTHORIZED", ex.getCode());
    }

    @Test
    @DisplayName("requireProjectId 在项目不存在时应抛出传入的 notFoundCode")
    void requireProjectId_projectNotFound_shouldThrowGivenNotFoundCode() {
        when(membershipQueryRepository.projectExists("550e8400-e29b-41d4-a716-446655440000")).thenReturn(false);
        BizException ex = assertThrows(BizException.class, () -> authzSdk.requireProjectId(
                "550e8400-e29b-41d4-a716-446655440000",
                "KB-400",
                "KB-400",
                "KB-404"));
        assertEquals("KB-404", ex.getCode());
    }

    @Test
    @DisplayName("requireProjectId 在空字符串时应抛出 requiredCode")
    void requireProjectId_blank_shouldThrowRequiredCode() {
        BizException ex = assertThrows(BizException.class, () -> authzSdk.requireProjectId("   ", "P-REQ", "P-INV", "P-404"));
        assertEquals("P-REQ", ex.getCode());
    }

    @Test
    @DisplayName("requireProjectId 在非法 UUID 时应抛出 invalidCode")
    void requireProjectId_invalidUuid_shouldThrowInvalidCode() {
        BizException ex = assertThrows(BizException.class, () -> authzSdk.requireProjectId("not-uuid", "P-REQ", "P-INV", "P-404"));
        assertEquals("P-INV", ex.getCode());
    }

    @Test
    @DisplayName("项目不存在时应返回 PROJECT-404")
    void authorize_projectNotExists_shouldReturnProject404() {
        when(membershipQueryRepository.projectExists("550e8400-e29b-41d4-a716-446655440000")).thenReturn(false);

        AuthzDecision decision = authzSdk.authorize(1L, "550e8400-e29b-41d4-a716-446655440000", Action.VIEW);

        assertFalse(decision.allowed());
        assertEquals("PROJECT-404", decision.denyCode());
    }

    @Test
    @DisplayName("用户非成员时应返回 PROJECT-403")
    void authorize_memberMissing_shouldReturnProject403() {
        when(membershipQueryRepository.projectExists("b25b3db6-3a3a-46ac-8117-06dc938acaed")).thenReturn(true);
        when(membershipQueryRepository.findRole("b25b3db6-3a3a-46ac-8117-06dc938acaed", 1L)).thenReturn(Optional.empty());

        AuthzDecision decision = authzSdk.authorize(1L, "b25b3db6-3a3a-46ac-8117-06dc938acaed", Action.VIEW);

        assertFalse(decision.allowed());
        assertEquals("PROJECT-403", decision.denyCode());
    }

    @Test
    @DisplayName("策略允许时应返回 allowed=true")
    void authorize_policyAllow_shouldReturnAllowed() {
        when(membershipQueryRepository.projectExists("550e8400-e29b-41d4-a716-446655440000")).thenReturn(true);
        when(membershipQueryRepository.findRole("550e8400-e29b-41d4-a716-446655440000", 1L))
                .thenReturn(Optional.of(ProjectRole.MEMBER));
        when(authzPolicyService.isAllowed(ProjectRole.MEMBER, Action.VIEW)).thenReturn(true);

        AuthzDecision decision = authzSdk.authorize(1L, "550e8400-e29b-41d4-a716-446655440000", Action.VIEW);

        assertTrue(decision.allowed());
    }

    @Test
    @DisplayName("策略拒绝时应返回 PROJECT-403")
    void authorize_policyDeny_shouldReturnProject403() {
        when(membershipQueryRepository.projectExists("550e8400-e29b-41d4-a716-446655440000")).thenReturn(true);
        when(membershipQueryRepository.findRole("550e8400-e29b-41d4-a716-446655440000", 1L))
                .thenReturn(Optional.of(ProjectRole.MEMBER));
        when(authzPolicyService.isAllowed(ProjectRole.MEMBER, Action.EDIT)).thenReturn(false);

        AuthzDecision decision = authzSdk.authorize(1L, "550e8400-e29b-41d4-a716-446655440000", Action.EDIT);

        assertFalse(decision.allowed());
        assertEquals("PROJECT-403", decision.denyCode());
    }

    @Test
    @DisplayName("鉴权内部异常时应降级返回 AUTHZ-500")
    void authorize_runtimeError_shouldReturnAuthz500() {
        when(membershipQueryRepository.projectExists("550e8400-e29b-41d4-a716-446655440000"))
                .thenThrow(new RuntimeException("boom"));

        AuthzDecision decision = authzSdk.authorize(1L, "550e8400-e29b-41d4-a716-446655440000", Action.VIEW);

        assertFalse(decision.allowed());
        assertEquals("AUTHZ-500", decision.denyCode());
    }

    @Test
    @DisplayName("requireRole 在角色不满足时应抛出 PROJECT-403")
    void requireRole_forbidden_shouldThrowProject403() {
        when(membershipQueryRepository.projectExists("550e8400-e29b-41d4-a716-446655440000")).thenReturn(true);
        when(membershipQueryRepository.findRole("550e8400-e29b-41d4-a716-446655440000", 1L))
                .thenReturn(Optional.of(ProjectRole.MEMBER));

        BizException ex = assertThrows(BizException.class,
                () -> authzSdk.requireRole(1L, "550e8400-e29b-41d4-a716-446655440000", Set.of(ProjectRole.OWNER)));

        assertEquals("PROJECT-403", ex.getCode());
    }

    @Test
    @DisplayName("isMember 在项目不存在时应返回 false")
    void isMember_projectNotFound_shouldReturnFalse() {
        when(membershipQueryRepository.projectExists("550e8400-e29b-41d4-a716-446655440000")).thenReturn(false);

        boolean result = authzSdk.isMember(1L, "550e8400-e29b-41d4-a716-446655440000");

        assertFalse(result);
    }

    @Test
    @DisplayName("isMember 命中缓存时应直接返回且不访问仓储")
    void isMember_cacheHit_shouldAvoidRepository() {
        InMemoryHitAuthzQueryCache cache = new InMemoryHitAuthzQueryCache();
        cache.putProjectExists("550e8400-e29b-41d4-a716-446655440000", true);
        cache.putRole("550e8400-e29b-41d4-a716-446655440000", 1L, ProjectRole.MEMBER);
        AuthzSdkImpl cachedSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, cache);

        boolean result = cachedSdk.isMember(1L, "550e8400-e29b-41d4-a716-446655440000");

        assertTrue(result);
        verifyNoInteractions(membershipQueryRepository);
    }

    private static class NoopAuthzQueryCache implements AuthzQueryCache {
        @Override
        public CachedValue<Boolean> getProjectExists(String projectId) {
            return CachedValue.miss();
        }

        @Override
        public void putProjectExists(String projectId, boolean exists) {
        }

        @Override
        public CachedValue<ProjectRole> getRole(String projectId, long userId) {
            return CachedValue.miss();
        }

        @Override
        public void putRole(String projectId, long userId, ProjectRole role) {
        }

        @Override
        public void evictProjectExists(String projectId) {
        }

        @Override
        public void evictRole(String projectId, long userId) {
        }

        @Override
        public void evictRoles(String projectId, java.util.Collection<Long> userIds) {
        }

        @Override
        public void evictRoleByProject(String projectId) {
        }
    }

    private static class InMemoryHitAuthzQueryCache extends NoopAuthzQueryCache {
        private final java.util.Map<String, Boolean> existsByProject = new java.util.HashMap<>();
        private final java.util.Map<String, ProjectRole> roleByProjectUser = new java.util.HashMap<>();

        @Override
        public CachedValue<Boolean> getProjectExists(String projectId) {
            if (!existsByProject.containsKey(projectId)) {
                return CachedValue.miss();
            }
            return CachedValue.hit(existsByProject.get(projectId));
        }

        @Override
        public void putProjectExists(String projectId, boolean exists) {
            existsByProject.put(projectId, exists);
        }

        @Override
        public CachedValue<ProjectRole> getRole(String projectId, long userId) {
            String key = projectId + ":" + userId;
            if (!roleByProjectUser.containsKey(key)) {
                return CachedValue.miss();
            }
            return CachedValue.hit(roleByProjectUser.get(key));
        }

        @Override
        public void putRole(String projectId, long userId, ProjectRole role) {
            roleByProjectUser.put(projectId + ":" + userId, role);
        }
    }
}
