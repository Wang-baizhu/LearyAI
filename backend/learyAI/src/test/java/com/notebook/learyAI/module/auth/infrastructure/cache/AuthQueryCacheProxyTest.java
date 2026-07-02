// Responsibility: Verify auth cache proxy enablement rules for positive and null cache entries.
package com.notebook.learyAI.module.auth.infrastructure.cache;

import com.notebook.learyAI.module.auth.application.AuthUserSummary;
import com.notebook.learyAI.module.auth.application.cache.AuthQueryCache;
import com.notebook.learyAI.module.auth.application.cache.CachedValue;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthQueryCacheProxyTest {
    @Mock
    private AuthQueryCache delegate;
    @Mock
    private RedisCacheSupport cacheSupport;

    @Test
    @DisplayName("正值 TTL 关闭但空值 TTL 开启时，getMe 仍应读取 delegate 以命中负缓存")
    void getMe_shouldReadDelegateWhenOnlyNullCacheEnabled() {
        AuthCacheProperties properties = new AuthCacheProperties();
        properties.setMeTtlSeconds(0);
        properties.setMeNullTtlSeconds(20);
        AuthQueryCacheProxy proxy = new AuthQueryCacheProxy(delegate, cacheSupport, properties);
        when(cacheSupport.isEnabled()).thenReturn(true);
        when(delegate.getMe(1L)).thenReturn(CachedValue.hit(null));

        CachedValue<AuthUserSummary> result = proxy.getMe(1L);

        assertTrue(result.isHit());
        verify(delegate).getMe(1L);
    }

    @Test
    @DisplayName("正值 TTL 和空值 TTL 都关闭时，getMe 应直接 miss")
    void getMe_shouldMissWhenAllCacheDisabled() {
        AuthCacheProperties properties = new AuthCacheProperties();
        properties.setMeTtlSeconds(0);
        properties.setMeNullTtlSeconds(0);
        AuthQueryCacheProxy proxy = new AuthQueryCacheProxy(delegate, cacheSupport, properties);
        when(cacheSupport.isEnabled()).thenReturn(true);

        CachedValue<AuthUserSummary> result = proxy.getMe(1L);

        assertTrue(!result.isHit());
        verify(delegate, never()).getMe(1L);
    }
}
