// Responsibility: Verify auth endpoints keep CORS headers for preflight and unauthorized responses.
package com.notebook.learyAI.module.auth.interfaces.controller;

import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthCorsIntegrationTest extends AbstractPgRedisIntegrationTest {
    private static final String WEB_ORIGIN = "http://192.168.31.160:8000";
    private static final String ANDROID_ORIGIN = "http://localhost";
    private static final String IOS_ORIGIN = "capacitor://localhost";

    @Autowired
    private WebApplicationContext webApplicationContext;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build();
    }

    @Test
    @DisplayName("登录预检请求应返回 CORS 响应头")
    void should_return_cors_headers_when_login_preflight() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .with(apiBackendHost())
                        .header(HttpHeaders.ORIGIN, WEB_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, WEB_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    @DisplayName("未登录访问 me 应返回 401 且保留 CORS 响应头")
    void should_keep_cors_headers_when_me_unauthorized() throws Exception {
        mockMvc.perform(get("/api/auth/me")
                        .with(apiBackendHost())
                        .header(HttpHeaders.ORIGIN, WEB_ORIGIN))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, WEB_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("任务 SSE 预检请求应返回 CORS 响应头")
    void should_return_cors_headers_when_taskSse_preflight() throws Exception {
        mockMvc.perform(options("/sse/tasks")
                        .with(apiBackendHost())
                        .header(HttpHeaders.ORIGIN, WEB_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "last-event-id"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, WEB_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    @DisplayName("原生容器 Origin 的登录预检与未登录 me 请求应保留 CORS 响应头")
    void should_keep_cors_headers_for_capacitor_origins() throws Exception {
        mockMvc.perform(options("/api/auth/login")
                        .with(apiBackendHost())
                        .header(HttpHeaders.ORIGIN, ANDROID_ORIGIN)
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, ANDROID_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));

        mockMvc.perform(get("/api/auth/me")
                        .with(apiBackendHost())
                        .header(HttpHeaders.ORIGIN, IOS_ORIGIN))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, IOS_ORIGIN))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private RequestPostProcessor apiBackendHost() {
        return request -> {
            request.setServerName("192.168.31.160");
            request.setServerPort(8080);
            return request;
        };
    }
}
