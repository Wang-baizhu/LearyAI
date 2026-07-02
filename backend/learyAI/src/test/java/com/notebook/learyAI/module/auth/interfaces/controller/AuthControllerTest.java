// Responsibility: Verify AuthController endpoint behaviors and session cookie semantics.
package com.notebook.learyAI.module.auth.interfaces.controller;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.AuthAppService;
import com.notebook.learyAI.module.auth.application.AuthResult;
import com.notebook.learyAI.module.auth.application.AuthUserSummary;
import com.notebook.learyAI.module.auth.application.SessionClientInfo;
import com.notebook.learyAI.module.auth.application.SessionResult;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.interfaces.dto.LoginRequest;
import com.notebook.learyAI.module.auth.interfaces.dto.RegisterRequest;
import com.notebook.learyAI.shared.exception.GlobalExceptionHandler;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {
    @Mock
    private AuthAppService authAppService;

    @Test
    @DisplayName("login 应写入会话 cookie")
    void login_shouldWriteSessionCookie() {
        AuthController controller = new AuthController(authAppService, authProps());
        LoginRequest request = new LoginRequest();
        request.setEmail("a@test.com");
        request.setPassword("pass-123456");
        request.setRememberMe(true);
        request.setDeviceId("dev-1");
        when(authAppService.login(eq("a@test.com"), eq("pass-123456"), eq(true), any()))
                .thenReturn(authResult(1L, "sid-1", 3600));

        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        httpRequest.addHeader("User-Agent", "JUnit");
        httpRequest.setRemoteAddr("127.0.0.1");
        MockHttpServletResponse httpResponse = new MockHttpServletResponse();

        controller.login(request, httpRequest, httpResponse);

        String setCookie = httpResponse.getHeader("Set-Cookie");
        assertTrue(setCookie.contains("LEARY_SESSION=sid-1"));
        assertTrue(setCookie.contains("HttpOnly"));
        assertTrue(setCookie.contains("SameSite=Lax"));
    }

    @Test
    @DisplayName("logout 读取 cookie 后应调用登出并清理 cookie")
    void logout_shouldDeleteSessionAndClearCookie() {
        AuthController controller = new AuthController(authAppService, authProps());
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setCookies(new Cookie("LEARY_SESSION", "sid-x"));
        MockHttpServletResponse response = new MockHttpServletResponse();

        controller.logout(request, response);

        verify(authAppService).logout("sid-x");
        String setCookie = response.getHeader("Set-Cookie");
        assertTrue(setCookie.contains("LEARY_SESSION="));
        assertTrue(setCookie.contains("Max-Age=0"));
    }

    @Test
    @DisplayName("register 应透传客户端信息并返回用户")
    void register_shouldPassClientInfo() {
        AuthController controller = new AuthController(authAppService, authProps());
        RegisterRequest request = new RegisterRequest();
        request.setName("u");
        request.setEmail("a@test.com");
        request.setPhone("13800000000");
        request.setPassword("pass-123456");
        request.setSmsCode("1234");
        request.setDeviceId("ios-1");
        when(authAppService.register(eq("u"), eq("a@test.com"), eq("13800000000"), eq("pass-123456"),
                eq("1234"), eq(false), any())).thenReturn(authResult(2L, "sid-2", 1800));

        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        httpRequest.addHeader("User-Agent", "UA-1");
        httpRequest.setRemoteAddr("10.0.0.8");
        MockHttpServletResponse httpResponse = new MockHttpServletResponse();

        var result = controller.register(request, httpRequest, httpResponse);

        assertEquals("OK", result.getCode());
        assertEquals("u", result.getData().getName());
        ArgumentCaptor<SessionClientInfo> clientInfoCaptor = ArgumentCaptor.forClass(SessionClientInfo.class);
        verify(authAppService).register(eq("u"), eq("a@test.com"), eq("13800000000"), eq("pass-123456"),
                eq("1234"), eq(false), clientInfoCaptor.capture());
        assertEquals("10.0.0.8", clientInfoCaptor.getValue().getIp());
        assertEquals("UA-1", clientInfoCaptor.getValue().getUserAgent());
        assertEquals("ios-1", clientInfoCaptor.getValue().getDeviceId());
    }

    @Test
    @DisplayName("register invite 应透传邀请码与客户端信息")
    void registerInvite_shouldPassInviteCodeAndClientInfo() {
        AuthController controller = new AuthController(authAppService, authProps());
        var request = new com.notebook.learyAI.module.auth.interfaces.dto.RegisterInviteRegisterRequest();
        request.setName("u");
        request.setEmail("invite@test.com");
        request.setPhone("13800000009");
        request.setPassword("pass-123456");
        request.setInviteCode("invite-001");
        request.setDeviceId("web-2");
        when(authAppService.registerWithInvite(eq("u"), eq("invite@test.com"), eq("13800000009"), eq("pass-123456"),
                eq("invite-001"), eq(false), any())).thenReturn(authResult(3L, "sid-3", 1800));

        MockHttpServletRequest httpRequest = new MockHttpServletRequest();
        httpRequest.addHeader("User-Agent", "UA-2");
        httpRequest.setRemoteAddr("10.0.0.9");
        MockHttpServletResponse httpResponse = new MockHttpServletResponse();

        var result = controller.registerWithInvite(request, httpRequest, httpResponse);

        assertEquals("OK", result.getCode());
        assertEquals("u", result.getData().getName());
        ArgumentCaptor<SessionClientInfo> clientInfoCaptor = ArgumentCaptor.forClass(SessionClientInfo.class);
        verify(authAppService).registerWithInvite(eq("u"), eq("invite@test.com"), eq("13800000009"), eq("pass-123456"),
                eq("invite-001"), eq(false), clientInfoCaptor.capture());
        assertEquals("10.0.0.9", clientInfoCaptor.getValue().getIp());
        assertEquals("UA-2", clientInfoCaptor.getValue().getUserAgent());
        assertEquals("web-2", clientInfoCaptor.getValue().getDeviceId());
    }

    @Test
    @DisplayName("me 应返回当前用户摘要")
    void me_shouldReturnCurrentUserSummary() {
        AuthController controller = new AuthController(authAppService, authProps());
        when(authAppService.getCurrentUser())
                .thenReturn(new AuthUserSummary(5L, "me", "me@test.com", "13800000000", UserMode.PRO.name()));

        var result = controller.me();

        assertEquals("OK", result.getCode());
        assertEquals("me", result.getData().getName());
        assertEquals("PRO", result.getData().getUserMode());
    }

    @Test
    @DisplayName("login 参数校验失败应返回 VALIDATION_ERROR")
    void login_invalidPayload_shouldReturnValidationError() throws Exception {
        AuthController controller = new AuthController(authAppService, authProps());
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();

        mockMvc.perform(post("/api/auth/login")
                        .contentType("application/json")
                        .content("{\"email\":\"bad-email\",\"password\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private AuthResult authResult(Long userId, String sessionId, long maxAge) {
        return new AuthResult(
                new AuthUserSummary(userId, "u", "a@test.com", "13800000000", UserMode.FREE.name()),
                new SessionResult(sessionId, maxAge)
        );
    }

    private AuthProperties authProps() {
        AuthProperties props = new AuthProperties();
        props.getCookie().setName("LEARY_SESSION");
        props.getCookie().setSameSite("Lax");
        return props;
    }
}
