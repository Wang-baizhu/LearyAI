// Responsibility: Verify AuthFilter protected-path auth behavior and context lifecycle.
package com.notebook.learyAI.module.auth.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.SessionAppService;
import com.notebook.learyAI.module.auth.domain.model.Session;
import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.domain.model.UserStatus;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import jakarta.servlet.http.Cookie;
import java.io.IOException;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthFilterTest {
    @Mock
    private SessionAppService sessionAppService;
    @Mock
    private UserRepository userRepository;

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("白名单路径应直接放行")
    void whitelistPath_shouldBypassFilter() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        verifyNoInteractions(sessionAppService);
    }

    @Test
    @DisplayName("受保护路径缺少会话 cookie 时应返回 401")
    void protectedPath_withoutSessionCookie_shouldReturnUnauthorized() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":\"UNAUTHORIZED\""));
    }

    @Test
    @DisplayName("GET /api/skills/tasks 应跳过 session cookie 校验")
    void skillTaskQuery_shouldBypassSessionLookup() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/skills/tasks");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        verifyNoInteractions(sessionAppService);
    }

    @Test
    @DisplayName("POST /api/skills/kb/token 仍应要求 session cookie")
    void skillTokenIssue_shouldStillRequireSession() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/skills/kb/token");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(401, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":\"UNAUTHORIZED\""));
    }

    @Test
    @DisplayName("有效会话应写入用户上下文并在请求结束后清理")
    void validSession_shouldSetAndClearCurrentUserContext() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.setCookies(new Cookie("LEARY_SESSION", "sid-1"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        Long userId = 9L;
        Session session = new Session("sid-1", userId, Instant.now().plusSeconds(1800), false,
                "127.0.0.1", "ua", "dev");
        when(sessionAppService.resolveSession("sid-1")).thenReturn(Optional.of(session));
        when(userRepository.findById(userId)).thenReturn(Optional.of(mockUser(userId, UserMode.FREE)));
        MockFilterChain chain = new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
                assertEquals(userId, CurrentUserContext.getUserId());
            }
        };

        filter.doFilter(request, response, chain);

        assertNull(CurrentUserContext.getUserId());
    }

    @Test
    @DisplayName("开启 test bypass 且 sessionId 匹配时应直接放行")
    void testBypassSession_shouldUseConfiguredUserId() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(true), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/projects");
        request.setCookies(new Cookie("LEARY_SESSION", "bypass-session"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
                assertEquals(100L, CurrentUserContext.getUserId());
            }
        };

        filter.doFilter(request, response, chain);

        verifyNoInteractions(sessionAppService);
        assertNull(CurrentUserContext.getUserId());
    }

    @Test
    @DisplayName("POST /api/tasks/{id}/status 默认应走会话鉴权")
    void taskStatusUpdatePath_shouldRequireAuthByDefault() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tasks/12/status");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(401, response.getStatus());
        verifyNoInteractions(sessionAppService);
    }

    @Test
    @DisplayName("GET /api/tasks/{id}/status 不属于特殊放行，应要求鉴权")
    void taskStatusQueryPath_shouldRequireAuth() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/tasks/12/status");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(401, response.getStatus());
    }

    @Test
    @DisplayName("internal-auth 通过且 GET /api/templates/plugin-manifest 时应 bypass")
    void internalTemplateManifestBypass_shouldSkipSessionLookup() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/templates/plugin-manifest");
        request.setAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR, true);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        verifyNoInteractions(sessionAppService);
    }
    @Test
    @DisplayName("internal-auth 通过且 GET /api/knowledge-bases/{kbId}/canvas 时应 bypass")
    void internalKnowledgeBaseCanvasQueryBypass_shouldSkipSessionLookup() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/knowledge-bases/kb-1/canvas");
        request.setAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR, true);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        verifyNoInteractions(sessionAppService);
    }

    @Test
    @DisplayName("internal-auth 通过且 PATCH /api/knowledge-bases/{kbId}/canvas 时应 bypass")
    void internalKnowledgeBaseCanvasUpdateBypass_shouldSkipSessionLookup() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/knowledge-bases/kb-1/canvas");
        request.setAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR, true);
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain();

        filter.doFilter(request, response, chain);

        assertEquals(200, response.getStatus());
        verifyNoInteractions(sessionAppService);
    }

    @Test
    @DisplayName("internal-auth 通过但非 bypass 路由时仍应按会话鉴权")
    void internalAuthPassedButNonBypassRoute_shouldStillRequireSession() throws ServletException, IOException {
        AuthFilter filter = new AuthFilter(sessionAppService, userRepository, authProps(false), new ObjectMapper(), false);
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/projects");
        request.setAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR, true);
        request.setCookies(new Cookie("LEARY_SESSION", "sid-1"));
        MockHttpServletResponse response = new MockHttpServletResponse();
        when(sessionAppService.resolveSession("sid-1")).thenReturn(Optional.of(
                new Session("sid-1", 8L, Instant.now().plusSeconds(1800), false, "127.0.0.1", "ua", "d1")
        ));
        when(userRepository.findById(8L)).thenReturn(Optional.of(mockUser(8L, UserMode.FREE)));

        filter.doFilter(request, response, new MockFilterChain());

        verify(sessionAppService).resolveSession("sid-1");
        assertNull(CurrentUserContext.getUserId());
    }

    private AuthProperties authProps(boolean bypass) {
        AuthProperties props = new AuthProperties();
        props.getCookie().setName("LEARY_SESSION");
        props.getCookie().setSameSite("Lax");
        props.getSession().setTestBypassEnabled(bypass);
        props.getSession().setTestBypassSessionId("bypass-session");
        props.getSession().setTestBypassUserId(100L);
        return props;
    }

    private User mockUser(Long userId, UserMode userMode) {
        Instant now = Instant.now();
        return new User(userId, "u" + userId, "u" + userId + "@test.com", "13800000000", "hash",
                UserStatus.ACTIVE, userMode, now, now);
    }
}
