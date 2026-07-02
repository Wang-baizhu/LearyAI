// Responsibility: Verify AuthzCacheEvictorImpl forwards cache invalidation calls correctly.
package com.notebook.learyAI.module.authz.application;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class AuthzCacheEvictorImplTest {
    @Mock
    private AuthzQueryCache authzQueryCache;

    @InjectMocks
    private AuthzCacheEvictorImpl evictor;

    @Test
    @DisplayName("evictRole: userId 为空时应直接返回")
    void evictRole_whenUserIdNull_shouldIgnore() {
        evictor.evictRole("p1", null);
        verify(authzQueryCache, never()).evictRole("p1", 1L);
    }

    @Test
    @DisplayName("evictRoles 与项目级失效应转发到底层缓存")
    void evictMethods_shouldDelegateToCache() {
        evictor.evictProjectExists("p1");
        evictor.evictRole("p1", 1L);
        evictor.evictRoles("p1", List.of(1L, 2L));
        evictor.evictProjectRoles("p1");

        verify(authzQueryCache).evictProjectExists("p1");
        verify(authzQueryCache).evictRole("p1", 1L);
        verify(authzQueryCache).evictRoles("p1", List.of(1L, 2L));
        verify(authzQueryCache).evictRoleByProject("p1");
    }
}
