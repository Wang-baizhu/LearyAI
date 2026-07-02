// Responsibility: Verify project write actions invalidate authz cache via real PostgreSQL and Redis.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.authz.application.AuthzCacheEvictorImpl;
import com.notebook.learyAI.module.authz.application.AuthzSdkImpl;
import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import com.notebook.learyAI.module.authz.infrastructure.cache.AuthzCacheProperties;
import com.notebook.learyAI.module.authz.infrastructure.cache.RedisAuthzQueryCache;
import com.notebook.learyAI.module.kb.application.KnowledgeBaseAppService;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectInviteRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.module.visit.application.UserResourceVisitAppService;
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
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.Set;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ProjectAuthzCacheInvalidationIntegrationTest extends AbstractPgRedisIntegrationTest {
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private ProjectMemberRepository projectMemberRepository;
    @Autowired
    private MembershipQueryRepository membershipQueryRepository;
    @Autowired
    private AuthzPolicyService authzPolicyService;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private TransactionTemplate transactionTemplate;

    private RedisCacheSupport redisCacheSupport;
    private ProjectAppService projectAppService;
    private AuthzSdkImpl authzSdk;
    private String testProjectId;
    private long testUserId;
    private long newOwnerUserId;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);
        testUserId = caseId;
        newOwnerUserId = caseId + 1;

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

        ProjectInviteRepository projectInviteRepository = mock(ProjectInviteRepository.class);
        UserResourceVisitAppService visitAppService = mock(UserResourceVisitAppService.class);
        UserRepository userRepository = mock(UserRepository.class);
        PermissionSupport permissionSupport = mock(PermissionSupport.class);
        KnowledgeBaseAppService knowledgeBaseAppService = mock(KnowledgeBaseAppService.class);

        when(permissionSupport.requireUserId()).thenReturn(testUserId);
        when(permissionSupport.requireProjectId(eq(testProjectId), anyString(), anyString(), anyString()))
                .thenReturn(testProjectId);
        doNothing().when(permissionSupport).requireOwnerRole(
                eq(testProjectId), eq(testUserId), anyString(), anyString(), anyString(), anyString()
        );

        projectAppService = new ProjectAppService(
                projectRepository,
                projectMemberRepository,
                projectInviteRepository,
                visitAppService,
                userRepository,
                permissionSupport,
                knowledgeBaseAppService,
                new AuthzCacheEvictorImpl(cache)
        );
        authzSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, cache);

        Instant now = Instant.now();
        projectRepository.save(new Project(testProjectId, "project-authz", testUserId, now, now));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, testUserId, ProjectMemberRole.OWNER, ProjectMemberStatus.ACTIVE, now, now
        ));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, newOwnerUserId, ProjectMemberRole.MEMBER, ProjectMemberStatus.ACTIVE, now, now
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
    @DisplayName("deleteProject 后应清理 projectExists 缓存并回源返回不存在（固定projectId/userId）")
    void deleteProject_thenAuthzQueryShouldReloadAndReturnNotFound() {
        assertEquals(testProjectId,
                authzSdk.requireProjectId(testProjectId, "PROJECT-400", "PROJECT-400", "PROJECT-404"));
        assertEquals(testProjectId,
                authzSdk.requireProjectId(testProjectId, "PROJECT-400", "PROJECT-400", "PROJECT-404"));

        transactionTemplate.executeWithoutResult(status -> projectAppService.deleteProject(testProjectId));

        BizException ex = assertThrows(BizException.class,
                () -> authzSdk.requireProjectId(testProjectId, "PROJECT-400", "PROJECT-400", "PROJECT-404"));
        assertEquals("PROJECT-404", ex.getCode());
    }

    @Test
    @DisplayName("transferOwner 后应清理旧/新owner角色缓存并回源重建（固定projectId/userId）")
    void transferOwner_thenOldAndNewOwnerRoleShouldReload() {
        assertEquals(ProjectRole.OWNER,
                authzSdk.requireRole(testUserId, testProjectId,
                        Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)));
        assertEquals(ProjectRole.MEMBER,
                authzSdk.requireRole(newOwnerUserId, testProjectId,
                        Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)));

        transactionTemplate.executeWithoutResult(status -> projectAppService.transferOwner(testProjectId, newOwnerUserId));

        assertEquals(ProjectRole.ADMIN,
                authzSdk.requireRole(testUserId, testProjectId,
                        Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)));
        assertEquals(ProjectRole.OWNER,
                authzSdk.requireRole(newOwnerUserId, testProjectId,
                        Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER)));
    }
}
