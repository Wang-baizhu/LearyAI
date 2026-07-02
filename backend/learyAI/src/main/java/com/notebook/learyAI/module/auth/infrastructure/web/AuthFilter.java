// Responsibility: Enforce session authentication for protected endpoints.
package com.notebook.learyAI.module.auth.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.application.SessionAppService;
import com.notebook.learyAI.module.auth.domain.model.Session;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.shared.api.ApiResponse;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;
import java.util.Optional;

@Component
public class AuthFilter extends OncePerRequestFilter {
    private final SessionAppService sessionAppService;
    private final UserRepository userRepository;
    private final AuthProperties authProperties;
    private final ObjectMapper objectMapper;
    private final boolean openApiDocsEnabled;

    public AuthFilter(SessionAppService sessionAppService,
                      UserRepository userRepository,
                      AuthProperties authProperties,
                      ObjectMapper objectMapper,
                      @Value("${springdoc.api-docs.enabled:false}") boolean openApiDocsEnabled) {
        this.sessionAppService = sessionAppService;
        this.userRepository = userRepository;
        this.authProperties = authProperties;
        this.objectMapper = objectMapper;
        this.openApiDocsEnabled = openApiDocsEnabled;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (isInternalTemplateManifestBypass(request)
                || isInternalKnowledgeBaseCanvasBypass(request)
                || isInternalTaskCreateBypass(request)
                || isInternalTaskStatusBypass(request)) {
            return true;
        }
        String path = request.getRequestURI();
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        if (path.startsWith("/api/auth/login")
                || path.startsWith("/api/auth/register")
                || path.startsWith("/api/auth/sms-code")
                || path.startsWith("/actuator/health")
                || path.startsWith("/actuator/prometheus")
                || path.startsWith("/error")) {
            return true;
        }
        if (openApiDocsEnabled && path.startsWith("/v3/api-docs")) {
            return true;
        }
        if (isSkillTokenBypass(request)) {
            return true;
        }
        if (!path.startsWith("/api/tasks")) {
            return false;
        }
        return false;
    }

    private boolean isSkillTokenBypass(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (!path.startsWith("/api/skills")) {
            return false;
        }
        return !"/api/skills/kb/token".equals(path);
    }

    private boolean isInternalTemplateManifestBypass(HttpServletRequest request) {
        Object passed = request.getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR);
        if (!Boolean.TRUE.equals(passed)) {
            return false;
        }
        return "/api/templates/plugin-manifest".equals(request.getRequestURI())
                && "GET".equalsIgnoreCase(request.getMethod());
    }

    private boolean isInternalTaskCreateBypass(HttpServletRequest request) {
        Object passed = request.getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR);
        if (!Boolean.TRUE.equals(passed)) {
            return false;
        }
        return "/api/tasks".equals(request.getRequestURI())
                && "POST".equalsIgnoreCase(request.getMethod());
    }

    private boolean isInternalKnowledgeBaseCanvasBypass(HttpServletRequest request) {
        Object passed = request.getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR);
        if (!Boolean.TRUE.equals(passed)) {
            return false;
        }
        String path = request.getRequestURI();
        String method = request.getMethod();
        if (!path.matches("^/api/knowledge-bases/[^/]+/canvas$")) {
            return false;
        }
        return "GET".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method);
    }

    private boolean isInternalTaskStatusBypass(HttpServletRequest request) {
        Object passed = request.getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR);
        if (!Boolean.TRUE.equals(passed)) {
            return false;
        }
        return "POST".equalsIgnoreCase(request.getMethod())
                && request.getRequestURI().matches("^/api/tasks/\\d+/status$");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String sessionId = readSessionId(request);
            if (sessionId == null) {
                writeUnauthorized(response);
                return;
            }
            if (isTestBypassSession(sessionId)) {
                Long userId = authProperties.getSession().getTestBypassUserId();
                if (userId == null) {
                    writeUnauthorized(response);
                    return;
                }
                CurrentUserContext.set(userId, UserMode.FREE);
                filterChain.doFilter(request, response);
                return;
            }
            Optional<Session> sessionOpt = sessionAppService.resolveSession(sessionId);
            if (sessionOpt.isEmpty()) {
                writeUnauthorized(response);
                return;
            }
            Session session = sessionOpt.get();
            Optional<UserMode> userModeOpt = userRepository.findById(session.getUserId())
                    .map(user -> user.getUserMode());
            if (userModeOpt.isEmpty()) {
                writeUnauthorized(response);
                return;
            }
            CurrentUserContext.set(session.getUserId(), userModeOpt.get());
            filterChain.doFilter(request, response);
        } finally {
            CurrentUserContext.clear();
        }
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

    private boolean isTestBypassSession(String sessionId) {
        AuthProperties.Session sessionConfig = authProperties.getSession();
        if (!sessionConfig.isTestBypassEnabled()) {
            return false;
        }
        String bypassId = sessionConfig.getTestBypassSessionId();
        return bypassId != null && bypassId.equals(sessionId);
    }

    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiResponse<Void> body = ApiResponse.error("UNAUTHORIZED", "unauthorized");
        objectMapper.writeValue(response.getWriter(), body);
    }
}
