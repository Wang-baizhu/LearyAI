// Responsibility: Verify project controller auth chain (AuthFilter -> Controller -> AppService -> Authz) with real infrastructure.
package com.notebook.learyAI.module.project.interfaces.controller;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.SessionAppService;
import com.notebook.learyAI.module.auth.application.SessionClientInfo;
import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.domain.model.UserStatus;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.auth.infrastructure.web.AuthFilter;
import com.notebook.learyAI.module.auth.infrastructure.web.InternalAuthFilter;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import jakarta.servlet.http.Cookie;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ProjectControllerAuthIntegrationTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private WebApplicationContext webApplicationContext;
    @Autowired
    private AuthFilter authFilter;
    @Autowired
    private InternalAuthFilter internalAuthFilter;
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private ProjectMemberRepository projectMemberRepository;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private SessionAppService sessionAppService;
    @Autowired
    private AuthProperties authProperties;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String testProjectId;
    private long ownerUserId;
    private long memberUserId;
    private String ownerSessionId;
    private String memberSessionId;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);

        mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext)
                .addFilters(internalAuthFilter, authFilter)
                .build();

        Instant now = Instant.now();
        User owner = userRepository.save(new User(null, "owner", "owner+" + caseId + "@test.com", "1380000" + (caseId % 10_000),
                "hash", UserStatus.ACTIVE, UserMode.FREE, now, now));
        User member = userRepository.save(new User(null, "member", "member+" + caseId + "@test.com", "1390000" + (caseId % 10_000),
                "hash", UserStatus.ACTIVE, UserMode.FREE, now, now));
        ownerUserId = owner.getId();
        memberUserId = member.getId();

        projectRepository.save(new Project(testProjectId, "p-auth-controller", ownerUserId, now, now));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, ownerUserId, ProjectMemberRole.OWNER, ProjectMemberStatus.ACTIVE, now, now
        ));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, memberUserId, ProjectMemberRole.MEMBER, ProjectMemberStatus.ACTIVE, now, now
        ));

        ownerSessionId = sessionAppService.createSession(
                ownerUserId, false, new SessionClientInfo("127.0.0.1", "junit-owner", "d-owner")
        ).getSessionId();
        memberSessionId = sessionAppService.createSession(
                memberUserId, false, new SessionClientInfo("127.0.0.1", "junit-member", "d-member")
        ).getSessionId();
    }

    @AfterEach
    void tearDown() {
        if (ownerSessionId != null) {
            sessionAppService.deleteSession(ownerSessionId);
        }
        if (memberSessionId != null) {
            sessionAppService.deleteSession(memberSessionId);
        }
        jdbcTemplate.update("delete from project_member where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from project where id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from auth_user where id in (?, ?)", ownerUserId, memberUserId);
    }

    @Test
    @DisplayName("未登录请求 owner-only 接口应返回 401")
    void unauthenticatedOwnerOnlyRequest_shouldReturn401() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}/members/{userId}", testProjectId, memberUserId))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    @DisplayName("成员调用 owner-only 接口应返回 PROJECT-403")
    void memberCallOwnerOnlyApi_shouldReturnProject403() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}/members/{userId}", testProjectId, ownerUserId)
                        .cookie(sessionCookie(memberSessionId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT-403"));
    }

    @Test
    @DisplayName("owner 调用 owner-only 接口应成功")
    void ownerCallOwnerOnlyApi_shouldSucceed() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}/members/{userId}", testProjectId, memberUserId)
                        .cookie(sessionCookie(ownerSessionId)))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("非法 projectId 应返回 PROJECT-400")
    void invalidProjectId_shouldReturnProject400() throws Exception {
        mockMvc.perform(get("/api/projects/{projectId}/members", "not-uuid")
                        .cookie(sessionCookie(ownerSessionId))
                        .accept(APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT-400"));
    }

    @Test
    @DisplayName("不存在的 projectId 应返回 PROJECT-404")
    void projectNotFound_shouldReturnProject404() throws Exception {
        mockMvc.perform(get("/api/projects/{projectId}/members", UUID.randomUUID().toString())
                        .cookie(sessionCookie(ownerSessionId))
                        .accept(APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("PROJECT-404"));
    }

    private Cookie sessionCookie(String sessionId) {
        return new Cookie(authProperties.getCookie().getName(), sessionId);
    }
}
