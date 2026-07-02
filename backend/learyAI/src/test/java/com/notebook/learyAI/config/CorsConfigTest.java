// Responsibility: Verify CORS config covers both API and SSE endpoints without booting full application context.
package com.notebook.learyAI.config;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.filter.CorsFilter;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CorsConfigTest {
    private static final String WEB_ORIGIN = "http://192.168.31.160:8000";
    private static final String ANDROID_ORIGIN = "http://localhost";
    private static final String IOS_ORIGIN = "capacitor://localhost";

    @Test
    @DisplayName("corsFilterRegistration: 任务 SSE 预检请求应返回跨域响应头")
    void corsFilterRegistration_shouldAllowTaskSsePreflight() throws Exception {
        CorsFilter filter = createCorsFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/sse/tasks");
        request.addHeader(HttpHeaders.ORIGIN, WEB_ORIGIN);
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET");
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "last-event-id");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, noopChain());

        assertEquals(WEB_ORIGIN, response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        assertEquals("true", response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }

    @Test
    @DisplayName("corsFilterRegistration: API 预检请求应继续返回跨域响应头")
    void corsFilterRegistration_shouldKeepApiPreflightAllowed() throws Exception {
        CorsFilter filter = createCorsFilter();
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/auth/login");
        request.addHeader(HttpHeaders.ORIGIN, WEB_ORIGIN);
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST");
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, noopChain());

        assertEquals(WEB_ORIGIN, response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        assertEquals("true", response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }

    @Test
    @DisplayName("corsFilterRegistration: 原生容器 Origin 的 API 与 SSE 预检请求应返回跨域响应头")
    void corsFilterRegistration_shouldAllowCapacitorOrigins() throws Exception {
        CorsFilter filter = createCorsFilter();

        assertPreflightAllowed(filter, ANDROID_ORIGIN, "/api/auth/login", "POST", "content-type");
        assertPreflightAllowed(filter, IOS_ORIGIN, "/sse/tasks", "GET", "last-event-id");
    }

    private CorsFilter createCorsFilter() {
        CorsProperties properties = new CorsProperties();
        properties.setAllowedOriginPatterns(List.of(WEB_ORIGIN, ANDROID_ORIGIN, IOS_ORIGIN));
        CorsConfig corsConfig = new CorsConfig(properties);
        FilterRegistrationBean<CorsFilter> registration = corsConfig.corsFilterRegistration();
        return registration.getFilter();
    }

    private void assertPreflightAllowed(
            CorsFilter filter,
            String origin,
            String path,
            String method,
            String requestHeaders
    ) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", path);
        request.setServerName("192.168.31.160");
        request.setServerPort(8080);
        request.addHeader(HttpHeaders.ORIGIN, origin);
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, method);
        request.addHeader(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, requestHeaders);
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, noopChain());

        assertEquals(origin, response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        assertEquals("true", response.getHeader(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS));
    }

    private FilterChain noopChain() {
        return (request, response) -> {
        };
    }
}
