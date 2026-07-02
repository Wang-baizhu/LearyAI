// Responsibility: Verify InternalAuthFilter internal token/source checks and user binding.
package com.notebook.learyAI.module.auth.infrastructure.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import jakarta.servlet.ServletException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InternalAuthFilterTest {
    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("受保护状态变更接口在 token 不匹配时应返回 403")
    void protectedTaskStatus_withInvalidToken_shouldReturnForbidden() throws ServletException, IOException {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tasks/12/status");
        request.addHeader("X-Internal-Source", "leary-agent");
        request.addHeader("X-Internal-Token", "wrong");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":\"FORBIDDEN\""));
    }

    @Test
    @DisplayName("受保护状态变更接口在 source 不匹配时应返回 403")
    void protectedTaskStatus_withInvalidSource_shouldReturnForbidden() throws ServletException, IOException {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tasks/12/status");
        request.addHeader("X-Internal-Source", "unknown-service");
        request.addHeader("X-Internal-Token", "token-1");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":\"FORBIDDEN\""));
    }

    @Test
    @DisplayName("任务创建接口携带内网头且鉴权通过时应绑定用户并标记 passed")
    void taskCreate_withValidInternalAuth_shouldBindUserContext() throws ServletException, IOException {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tasks");
        request.addHeader("X-Internal-Source", "leary-agent");
        request.addHeader("X-Internal-Token", "token-1");
        request.addHeader("X-Internal-User-Id", "21");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
                assertEquals(21L, CurrentUserContext.getUserId());
                assertEquals(Boolean.TRUE, ((jakarta.servlet.http.HttpServletRequest) request)
                        .getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR));
            }
        };

        filter.doFilter(request, response, chain);

        assertNull(CurrentUserContext.getUserId());
    }

    @Test
    @DisplayName("任务创建接口未携带内网头时应跳过过滤")
    void taskCreate_withoutInternalHeader_shouldBypass() throws ServletException, IOException {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/tasks");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(200, response.getStatus());
        assertNull(request.getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR));
    }

    @Test
    @DisplayName("模板运行时清单接口携带合法内网头时应绑定用户并标记 passed")
    void templatePluginManifest_withValidInternalAuth_shouldBindUserContext() throws ServletException, IOException {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/templates/plugin-manifest");
        request.addHeader("X-Internal-Source", "leary-agent");
        request.addHeader("X-Internal-Token", "token-1");
        request.addHeader("X-Internal-User-Id", "21");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
                assertEquals(21L, CurrentUserContext.getUserId());
                assertEquals(Boolean.TRUE, ((jakarta.servlet.http.HttpServletRequest) request)
                        .getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR));
            }
        };

        filter.doFilter(request, response, chain);

        assertNull(CurrentUserContext.getUserId());
    }

    @Test
    @DisplayName("模板运行时清单接口缺少内网头时应返回 403")
    void templatePluginManifest_withoutInternalHeader_shouldReturnForbidden() throws ServletException, IOException {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/templates/plugin-manifest");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(403, response.getStatus());
        assertTrue(response.getContentAsString().contains("\"code\":\"FORBIDDEN\""));
    }

    @Test
    @DisplayName("知识库画布查询接口携带内网头且鉴权通过时应绑定用户并标记 passed")
    void knowledgeBaseCanvasQuery_withValidInternalAuth_shouldBindUserContext() throws ServletException, IOException {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/knowledge-bases/kb-1/canvas");
        request.addHeader("X-Internal-Source", "leary-agent");
        request.addHeader("X-Internal-Token", "token-1");
        request.addHeader("X-Internal-User-Id", "21");
        MockHttpServletResponse response = new MockHttpServletResponse();
        MockFilterChain chain = new MockFilterChain() {
            @Override
            public void doFilter(jakarta.servlet.ServletRequest request, jakarta.servlet.ServletResponse response) {
                assertEquals(21L, CurrentUserContext.getUserId());
                assertEquals(Boolean.TRUE, ((jakarta.servlet.http.HttpServletRequest) request)
                        .getAttribute(InternalAuthFilter.INTERNAL_AUTH_PASSED_ATTR));
            }
        };

        filter.doFilter(request, response, chain);

        assertNull(CurrentUserContext.getUserId());
    }

    @Test
    @DisplayName("知识库画布更新接口缺少内网头时应跳过 internal-auth，留给会话鉴权处理")
    void knowledgeBaseCanvasUpdate_withoutInternalHeader_shouldSkipInternalAuth() {
        InternalAuthFilter filter = new InternalAuthFilter(authProps(), new ObjectMapper());
        MockHttpServletRequest request = new MockHttpServletRequest("PATCH", "/api/knowledge-bases/kb-1/canvas");

        assertTrue(filter.shouldNotFilter(request));
    }

    private AuthProperties authProps() {
        AuthProperties props = new AuthProperties();
        props.getInternal().setEnabled(true);
        props.getInternal().setToken("token-1");
        props.getInternal().setHeaderName("X-Internal-Token");
        props.getInternal().setSourceHeaderName("X-Internal-Source");
        props.getInternal().setSourceWhitelist(List.of("leary-agent", "leary-task"));
        return props;
    }
}
