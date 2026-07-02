// Responsibility: Expose auth endpoints for register/login/logout/me.
package com.notebook.learyAI.module.auth.interfaces.controller;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.AuthAppService;
import com.notebook.learyAI.module.auth.application.AuthResult;
import com.notebook.learyAI.module.auth.application.AuthUserSummary;
import com.notebook.learyAI.module.auth.application.SessionClientInfo;
import com.notebook.learyAI.module.auth.application.SessionResult;
import com.notebook.learyAI.module.auth.interfaces.dto.LoginRequest;
import com.notebook.learyAI.module.auth.interfaces.dto.RegisterInviteRegisterRequest;
import com.notebook.learyAI.module.auth.interfaces.dto.RegisterRequest;
import com.notebook.learyAI.module.auth.interfaces.dto.UserResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;

import java.time.Duration;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthAppService authAppService;
    private final AuthProperties authProperties;

    public AuthController(AuthAppService authAppService, AuthProperties authProperties) {
        this.authAppService = authAppService;
        this.authProperties = authProperties;
    }

    @PostMapping("/register")
    public ApiResponse<UserResponse> register(@Valid @RequestBody RegisterRequest request,
                                              HttpServletRequest httpRequest,
                                              HttpServletResponse httpResponse) {
        AuthResult result = authAppService.register(
                request.getName(),
                request.getEmail(),
                request.getPhone(),
                request.getPassword(),
                request.getSmsCode(),
                request.isRememberMe(),
                buildClientInfo(request.getDeviceId(), httpRequest)
        );
        writeSessionCookie(httpResponse, result.getSession());
        return ApiResponse.ok("注册成功", toResponse(result.getUser()));
    }

    @PostMapping("/register/invite")
    public ApiResponse<UserResponse> registerWithInvite(@Valid @RequestBody RegisterInviteRegisterRequest request,
                                                        HttpServletRequest httpRequest,
                                                        HttpServletResponse httpResponse) {
        AuthResult result = authAppService.registerWithInvite(
                request.getName(),
                request.getEmail(),
                request.getPhone(),
                request.getPassword(),
                request.getInviteCode(),
                request.isRememberMe(),
                buildClientInfo(request.getDeviceId(), httpRequest)
        );
        writeSessionCookie(httpResponse, result.getSession());
        return ApiResponse.ok("邀请码注册成功", toResponse(result.getUser()));
    }

    @PostMapping("/login")
    public ApiResponse<UserResponse> login(@Valid @RequestBody LoginRequest request,
                                           HttpServletRequest httpRequest,
                                           HttpServletResponse httpResponse) {
        AuthResult result = authAppService.login(
                request.getEmail(),
                request.getPassword(),
                request.isRememberMe(),
                buildClientInfo(request.getDeviceId(), httpRequest)
        );
        writeSessionCookie(httpResponse, result.getSession());
        return ApiResponse.ok("登录成功", toResponse(result.getUser()));
    }

    @PostMapping("/logout")
    public ApiResponse<Void> logout(HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        String sessionId = readSessionId(httpRequest);
        if (sessionId != null) {
            authAppService.logout(sessionId);
        }
        clearSessionCookie(httpResponse);
        return ApiResponse.ok("退出登录成功", null);
    }

    @GetMapping("/me")
    public ApiResponse<UserResponse> me() {
        AuthUserSummary user = authAppService.getCurrentUser();
        return ApiResponse.ok("获取当前用户信息成功", toResponse(user));
    }

    private SessionClientInfo buildClientInfo(String deviceId, HttpServletRequest request) {
        String userAgent = request.getHeader("User-Agent");
        return new SessionClientInfo(request.getRemoteAddr(), userAgent, deviceId);
    }

    private void writeSessionCookie(HttpServletResponse response, SessionResult session) {
        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from(authProperties.getCookie().getName(),
                session.getSessionId())
                .httpOnly(true)
                .path("/")
                .sameSite(authProperties.getCookie().getSameSite());
        if (session.getCookieMaxAgeSeconds() >= 0) {
            builder.maxAge(Duration.ofSeconds(session.getCookieMaxAgeSeconds()));
        }
        response.addHeader(HttpHeaders.SET_COOKIE, builder.build().toString());
    }

    private void clearSessionCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from(authProperties.getCookie().getName(), "")
                .httpOnly(true)
                .path("/")
                .maxAge(Duration.ZERO)
                .sameSite(authProperties.getCookie().getSameSite())
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private String readSessionId(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (authProperties.getCookie().getName().equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }

    private UserResponse toResponse(AuthUserSummary user) {
        return new UserResponse(user.getUserId(), user.getName(), user.getEmail(), user.getPhone(), user.getUserMode());
    }
}
