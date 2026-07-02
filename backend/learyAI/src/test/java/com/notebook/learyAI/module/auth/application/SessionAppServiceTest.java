// Responsibility: Verify SessionAppService core session lifecycle behaviors.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.domain.model.Session;
import com.notebook.learyAI.module.auth.domain.repository.SessionRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SessionAppServiceTest {
    @Mock
    private SessionRepository sessionRepository;
    @Mock
    private AuthPolicy authPolicy;

    @Test
    @DisplayName("createSession 应持久化会话并在非 rememberMe 返回会话级 Cookie")
    void createSession_shouldPersistAndReturnSessionCookie() {
        AuthProperties props = new AuthProperties();
        SessionAppService service = new SessionAppService(sessionRepository, authPolicy, props);
        when(authPolicy.resolveSessionTtlSeconds(false)).thenReturn(1800L);

        SessionResult result = service.createSession(1L, false, new SessionClientInfo("127.0.0.1", "ua", "d1"));

        assertNotNull(result.getSessionId());
        assertEquals(-1L, result.getCookieMaxAgeSeconds());
        verify(sessionRepository).save(any(Session.class), org.mockito.ArgumentMatchers.eq(1800L));
    }

    @Test
    @DisplayName("resolveSession 过期会话应删除并返回 empty")
    void resolveSession_expired_shouldDeleteAndReturnEmpty() {
        AuthProperties props = new AuthProperties();
        SessionAppService service = new SessionAppService(sessionRepository, authPolicy, props);
        Session expired = new Session("sid-1", 1L, Instant.now().minusSeconds(5), false, "ip", "ua", "d1");
        when(sessionRepository.findById("sid-1")).thenReturn(Optional.of(expired));

        Optional<Session> result = service.resolveSession("sid-1");

        assertTrue(result.isEmpty());
        verify(sessionRepository).deleteById("sid-1");
    }

    @Test
    @DisplayName("resolveSession 续期触发时应保存新过期时间并返回 renewed session")
    void resolveSession_shouldRenewWhenPolicySaysSo() {
        AuthProperties props = new AuthProperties();
        SessionAppService service = new SessionAppService(sessionRepository, authPolicy, props);
        Instant expiresAt = Instant.now().plusSeconds(10);
        Instant renewedAt = Instant.now().plusSeconds(1800);
        Session original = new Session("sid-1", 1L, expiresAt, false, "ip", "ua", "d1");
        when(sessionRepository.findById("sid-1")).thenReturn(Optional.of(original));
        when(authPolicy.shouldRenew(org.mockito.ArgumentMatchers.eq(false), org.mockito.ArgumentMatchers.eq(expiresAt), any()))
                .thenReturn(true);
        when(authPolicy.renewExpiry(any())).thenReturn(renewedAt);
        when(authPolicy.resolveSessionTtlSeconds(false)).thenReturn(1800L);

        Optional<Session> result = service.resolveSession("sid-1");

        assertTrue(result.isPresent());
        assertEquals(renewedAt, result.get().getExpiresAt());
        ArgumentCaptor<Session> captor = ArgumentCaptor.forClass(Session.class);
        verify(sessionRepository).save(captor.capture(), org.mockito.ArgumentMatchers.eq(1800L));
        assertEquals(renewedAt, captor.getValue().getExpiresAt());
    }

    @Test
    @DisplayName("resolveSession 仓储 miss 且 test bypass 未配置时应返回 empty")
    void resolveSession_missWithoutBypass_shouldReturnEmpty() {
        AuthProperties props = new AuthProperties();
        props.getSession().setTestBypassEnabled(false);
        SessionAppService service = new SessionAppService(sessionRepository, authPolicy, props);
        when(sessionRepository.findById("sid-miss")).thenReturn(Optional.empty());

        Optional<Session> result = service.resolveSession("sid-miss");

        assertFalse(result.isPresent());
    }

    @Test
    @DisplayName("deleteSession 应调用仓储删除")
    void deleteSession_shouldDeleteById() {
        AuthProperties props = new AuthProperties();
        SessionAppService service = new SessionAppService(sessionRepository, authPolicy, props);

        service.deleteSession("sid-del");

        verify(sessionRepository).deleteById("sid-del");
    }
}
