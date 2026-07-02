// Responsibility: Verify authz cache proxy enablement rules for positive and null cache entries.
package com.notebook.learyAI.module.authz.infrastructure.cache;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.application.cache.CachedValue;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthzQueryCacheProxyTest {
    @Mock
    private AuthzQueryCache delegate;
    @Mock
    private RedisCacheSupport cacheSupport;

    @Test
    @DisplayName("projectExists 正值 TTL 关闭但空值 TTL 开启时，仍应读取 delegate 以命中负缓存")
    void getProjectExists_shouldReadDelegateWhenOnlyNullCacheEnabled() {
        AuthzCacheProperties properties = new AuthzCacheProperties();
        properties.setProjectExistsTtlSeconds(0);
        properties.setProjectExistsNullTtlSeconds(20);
        AuthzQueryCacheProxy proxy = new AuthzQueryCacheProxy(delegate, cacheSupport, properties);
        when(cacheSupport.isEnabled()).thenReturn(true);
        when(delegate.getProjectExists("p1")).thenReturn(CachedValue.hit(Boolean.FALSE));

        CachedValue<Boolean> result = proxy.getProjectExists("p1");

        assertTrue(result.isHit());
        assertEquals(Boolean.FALSE, result.getValue());
        verify(delegate).getProjectExists("p1");
    }

    @Test
    @DisplayName("role 正值 TTL 关闭但空值 TTL 开启时，仍应读取 delegate 以命中负缓存")
    void getRole_shouldReadDelegateWhenOnlyNullCacheEnabled() {
        AuthzCacheProperties properties = new AuthzCacheProperties();
        properties.setRoleTtlSeconds(0);
        properties.setRoleNullTtlSeconds(20);
        AuthzQueryCacheProxy proxy = new AuthzQueryCacheProxy(delegate, cacheSupport, properties);
        when(cacheSupport.isEnabled()).thenReturn(true);
        when(delegate.getRole("p1", 1L)).thenReturn(CachedValue.hit(null));

        CachedValue<ProjectRole> result = proxy.getRole("p1", 1L);

        assertTrue(result.isHit());
        verify(delegate).getRole("p1", 1L);
    }

    @Test
    @DisplayName("role 正值 TTL 和空值 TTL 都关闭时，应直接 miss")
    void getRole_shouldMissWhenAllCacheDisabled() {
        AuthzCacheProperties properties = new AuthzCacheProperties();
        properties.setRoleTtlSeconds(0);
        properties.setRoleNullTtlSeconds(0);
        AuthzQueryCacheProxy proxy = new AuthzQueryCacheProxy(delegate, cacheSupport, properties);
        when(cacheSupport.isEnabled()).thenReturn(true);

        CachedValue<ProjectRole> result = proxy.getRole("p1", 1L);

        assertTrue(!result.isHit());
        verify(delegate, never()).getRole("p1", 1L);
    }
}
