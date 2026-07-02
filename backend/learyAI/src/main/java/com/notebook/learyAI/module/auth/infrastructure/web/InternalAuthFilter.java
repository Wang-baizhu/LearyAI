// Responsibility: Enforce internal auth for protected internal endpoints.
package com.notebook.learyAI.module.auth.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.shared.api.ApiResponse;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 1)
public class InternalAuthFilter extends OncePerRequestFilter {
    public static final String INTERNAL_AUTH_PASSED_ATTR = "internalAuthPassed";
    private static final String DEFAULT_HEADER = "X-Internal-Token";
    private static final String USER_ID_HEADER = "X-Internal-User-Id";
    private static final String DEFAULT_SOURCE_HEADER = "X-Internal-Source";

    private final AuthProperties authProperties;
    private final ObjectMapper objectMapper;

    public InternalAuthFilter(AuthProperties authProperties, ObjectMapper objectMapper) {
        this.authProperties = authProperties;
        this.objectMapper = objectMapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        String method = request.getMethod();
        if (isTaskInternalProtected(path, method)) {
            return !hasInternalHeader(request);
        }
        if (isTemplateManifestProtected(path, method)) {
            // Runtime manifest is internal-only: always enter this filter and reject requests without valid headers.
            return false;
        }
        if (isKnowledgeBaseCanvasProtected(path, method)) {
            return !hasInternalHeader(request);
        }
        if (isTaskCreateProtected(path, method)) {
            return !hasInternalHeader(request);
        }
        return true;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        AuthProperties.Internal internal = authProperties.getInternal();
        if (!internal.isEnabled()) {
            filterChain.doFilter(request, response);
            return;
        }
        boolean authPassed = isSourceAllowed(request, internal) && isTokenAllowed(request, internal);
        if (!authPassed) {
            writeForbidden(response);
            return;
        }
        request.setAttribute(INTERNAL_AUTH_PASSED_ATTR, Boolean.TRUE);
        boolean userBound = false;
        try {
            if (isTemplateManifestProtected(request.getRequestURI(), request.getMethod())
                    || isKnowledgeBaseCanvasProtected(request.getRequestURI(), request.getMethod())
                    || isTaskCreateProtected(request.getRequestURI(), request.getMethod())) {
                Long userId = resolveInternalUserId(request);
                if (userId == null) {
                    writeForbidden(response);
                    return;
                }
                CurrentUserContext.setUserId(userId);
                userBound = true;
            }
            filterChain.doFilter(request, response);
        } finally {
            if (userBound) {
                CurrentUserContext.clear();
            }
        }
    }

    private boolean isTokenAllowed(HttpServletRequest request, AuthProperties.Internal internal) {
        String headerName = internal.getHeaderName();
        if (headerName == null || headerName.isBlank()) {
            headerName = DEFAULT_HEADER;
        }
        String expected = internal.getToken();
        if (expected == null || expected.isBlank()) {
            return false;
        }
        String actual = request.getHeader(headerName);
        return expected.equals(actual);
    }

    private boolean hasInternalHeader(HttpServletRequest request) {
        AuthProperties.Internal internal = authProperties.getInternal();
        String headerName = internal == null ? null : internal.getHeaderName();
        if (headerName == null || headerName.isBlank()) {
            headerName = DEFAULT_HEADER;
        }
        String actual = request.getHeader(headerName);
        return actual != null && !actual.isBlank();
    }

    private Long resolveInternalUserId(HttpServletRequest request) {
        String value = request.getHeader(USER_ID_HEADER);
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            long parsed = Long.parseLong(value.trim());
            return parsed > 0 ? parsed : null;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private boolean isTaskInternalProtected(String path, String method) {
        if (!path.startsWith("/api/tasks")) {
            return false;
        }
        if (!"POST".equalsIgnoreCase(method)) {
            return false;
        }
        return path.matches("^/api/tasks/\\d+/status$");
    }

    private boolean isTaskCreateProtected(String path, String method) {
        return "/api/tasks".equals(path) && "POST".equalsIgnoreCase(method);
    }

    private boolean isTemplateManifestProtected(String path, String method) {
        return "/api/templates/plugin-manifest".equals(path) && "GET".equalsIgnoreCase(method);
    }

    private boolean isKnowledgeBaseCanvasProtected(String path, String method) {
        if (!path.matches("^/api/knowledge-bases/[^/]+/canvas$")) {
            return false;
        }
        return "GET".equalsIgnoreCase(method) || "PATCH".equalsIgnoreCase(method);
    }

    private boolean isSourceAllowed(HttpServletRequest request, AuthProperties.Internal internal) {
        List<String> whitelist = internal.getSourceWhitelist();
        if (whitelist == null || whitelist.isEmpty()) {
            return false;
        }
        String headerName = internal.getSourceHeaderName();
        if (headerName == null || headerName.isBlank()) {
            headerName = DEFAULT_SOURCE_HEADER;
        }
        String source = request.getHeader(headerName);
        if (source == null || source.isBlank()) {
            return false;
        }
        String normalizedSource = source.trim();
        for (String allowed : whitelist) {
            if (allowed == null || allowed.isBlank()) {
                continue;
            }
            if (normalizedSource.equals(allowed.trim())) {
                return true;
            }
        }
        return false;
    }

    private void writeForbidden(HttpServletResponse response) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        ApiResponse<Void> body = ApiResponse.error("FORBIDDEN", "internal access denied");
        objectMapper.writeValue(response.getWriter(), body);
    }
}
