// Responsibility: Verify end-to-end authz role-action matrix with real PostgreSQL and Redis cache.
package com.notebook.learyAI.module.authz.application;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.AuthzDecision;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import com.notebook.learyAI.module.authz.infrastructure.cache.AuthzCacheProperties;
import com.notebook.learyAI.module.authz.infrastructure.cache.RedisAuthzQueryCache;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import com.notebook.learyAI.shared.cache.CacheCommonProperties;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AuthzE2EIntegrationTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private MembershipQueryRepository membershipQueryRepository;
    @Autowired
    private AuthzPolicyService authzPolicyService;
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private ProjectMemberRepository projectMemberRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private RedisCacheSupport redisCacheSupport;
    private AuthzSdkImpl authzSdk;
    private String testProjectId;
    private long ownerUserId;
    private long adminUserId;
    private long memberUserId;
    private long outsiderUserId;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);
        ownerUserId = caseId;
        adminUserId = caseId + 1;
        memberUserId = caseId + 2;
        outsiderUserId = caseId + 3;

        CacheCommonProperties commonProperties = new CacheCommonProperties();
        commonProperties.setEnabled(true);
        commonProperties.setJitterPercent(0);
        commonProperties.setSecondDeleteEnabled(false);
        redisCacheSupport = new RedisCacheSupport(stringRedisTemplate, commonProperties);

        AuthzCacheProperties authzCacheProperties = new AuthzCacheProperties();
        authzCacheProperties.setProjectExistsTtlSeconds(600);
        authzCacheProperties.setRoleTtlSeconds(600);
        authzCacheProperties.setProjectExistsNullTtlSeconds(120);
        authzCacheProperties.setRoleNullTtlSeconds(120);
        AuthzQueryCache cache = new RedisAuthzQueryCache(redisCacheSupport, stringRedisTemplate, authzCacheProperties);
        authzSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, cache);

        Instant now = Instant.now();
        projectRepository.save(new Project(testProjectId, "p-authz-e2e", ownerUserId, now, now));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, ownerUserId, ProjectMemberRole.OWNER, ProjectMemberStatus.ACTIVE, now, now
        ));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, adminUserId, ProjectMemberRole.ADMIN, ProjectMemberStatus.ACTIVE, now, now
        ));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, memberUserId, ProjectMemberRole.MEMBER, ProjectMemberStatus.ACTIVE, now, now
        ));
    }

    @AfterEach
    void tearDown() {
        deleteRedisByPattern("authz:project-exists:" + testProjectId);
        deleteRedisByPattern("authz:role:" + testProjectId + ":*");
        if (redisCacheSupport != null) {
            redisCacheSupport.destroy();
        }
        jdbcTemplate.update("delete from project_member where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from project where id = cast(? as uuid)", testProjectId);
    }

    @Test
    @DisplayName("OWNER 应允许 VIEW/EDIT/MANAGE")
    void owner_shouldAllowViewEditManage() {
        assertAllowed(ownerUserId, Action.VIEW, ProjectRole.OWNER);
        assertAllowed(ownerUserId, Action.EDIT, ProjectRole.OWNER);
        assertAllowed(ownerUserId, Action.MANAGE, ProjectRole.OWNER);
        assertEquals(ProjectRole.OWNER, authzSdk.requireRole(ownerUserId, testProjectId, Set.of(ProjectRole.OWNER)));
    }

    @Test
    @DisplayName("ADMIN 应允许 VIEW/EDIT，拒绝 MANAGE")
    void admin_shouldAllowViewEdit_butDenyManage() {
        assertAllowed(adminUserId, Action.VIEW, ProjectRole.ADMIN);
        assertAllowed(adminUserId, Action.EDIT, ProjectRole.ADMIN);

        AuthzDecision decision = authzSdk.authorize(adminUserId, testProjectId, Action.MANAGE);
        assertFalse(decision.allowed());
        assertEquals("PROJECT-403", decision.denyCode());
    }

    @Test
    @DisplayName("MEMBER 应仅允许 VIEW，拒绝 EDIT/MANAGE")
    void member_shouldAllowView_butDenyEditManage() {
        assertAllowed(memberUserId, Action.VIEW, ProjectRole.MEMBER);

        AuthzDecision editDecision = authzSdk.authorize(memberUserId, testProjectId, Action.EDIT);
        assertFalse(editDecision.allowed());
        assertEquals("PROJECT-403", editDecision.denyCode());

        AuthzDecision manageDecision = authzSdk.authorize(memberUserId, testProjectId, Action.MANAGE);
        assertFalse(manageDecision.allowed());
        assertEquals("PROJECT-403", manageDecision.denyCode());
    }

    @Test
    @DisplayName("非成员应拒绝所有 Action")
    void outsider_shouldDenyAllActions() {
        assertDeniedWithCode(outsiderUserId, Action.VIEW, "PROJECT-403");
        assertDeniedWithCode(outsiderUserId, Action.EDIT, "PROJECT-403");
        assertDeniedWithCode(outsiderUserId, Action.MANAGE, "PROJECT-403");
    }

    @Test
    @DisplayName("项目不存在时 authorize/requireProjectId 应返回 PROJECT-404")
    void notFoundProject_shouldReturnProject404() {
        String projectId = UUID.randomUUID().toString();

        AuthzDecision decision = authzSdk.authorize(ownerUserId, projectId, Action.VIEW);
        assertFalse(decision.allowed());
        assertEquals("PROJECT-404", decision.denyCode());

        BizException ex = assertThrows(BizException.class,
                () -> authzSdk.requireProjectId(projectId, "PROJECT-400", "PROJECT-400", "PROJECT-404"));
        assertEquals("PROJECT-404", ex.getCode());
    }

    @Test
    @DisplayName("非法 projectId 时 requireProjectId 应返回 PROJECT-400")
    void invalidProjectId_shouldReturnProject400() {
        BizException ex = assertThrows(BizException.class,
                () -> authzSdk.requireProjectId("bad-project-id", "PROJECT-400", "PROJECT-400", "PROJECT-404"));
        assertEquals("PROJECT-400", ex.getCode());
    }

    private void assertAllowed(long userId, Action action, ProjectRole expectedRole) {
        AuthzDecision decision = authzSdk.authorize(userId, testProjectId, action);
        assertTrue(decision.allowed());
        assertEquals(expectedRole, decision.role());
    }

    private void assertDeniedWithCode(long userId, Action action, String expectedCode) {
        AuthzDecision decision = authzSdk.authorize(userId, testProjectId, action);
        assertFalse(decision.allowed());
        assertEquals(expectedCode, decision.denyCode());
    }
}
