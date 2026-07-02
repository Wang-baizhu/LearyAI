// Responsibility: Verify authz cache read/write/evict flow with real PostgreSQL and Redis.
package com.notebook.learyAI.module.authz.application;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import com.notebook.learyAI.module.authz.infrastructure.cache.AuthzCacheProperties;
import com.notebook.learyAI.module.authz.infrastructure.cache.RedisAuthzQueryCache;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzCacheEvictor;
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
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AuthzCacheIntegrationFlowTest extends AbstractPgRedisIntegrationTest {
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
    private String testProjectId;
    private long testUserId;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);
        testUserId = caseId;

        CacheCommonProperties commonProperties = new CacheCommonProperties();
        commonProperties.setEnabled(true);
        commonProperties.setJitterPercent(0);
        commonProperties.setSecondDeleteEnabled(false);
        redisCacheSupport = new RedisCacheSupport(stringRedisTemplate, commonProperties);

        Instant now = Instant.now();
        projectRepository.save(new Project(testProjectId, "p-authz", testUserId, now, now));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, testUserId, ProjectMemberRole.OWNER, ProjectMemberStatus.ACTIVE, now, now
        ));
    }

    @AfterEach
    void tearDown() {
        stringRedisTemplate.delete("authz:project-exists:" + testProjectId);
        stringRedisTemplate.delete("authz:role:" + testProjectId + ":" + testUserId);
        if (redisCacheSupport != null) {
            redisCacheSupport.destroy();
        }
        jdbcTemplate.update("delete from project_member where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from project where id = cast(? as uuid)", testProjectId);
    }

    @Test
    @DisplayName("固定项目与用户：缓存命中应减少重复查库，失效后应重新回源")
    void fixedProjectAndUser_shouldUseCacheThenReloadAfterEvict() {
        AuthzQueryCache cache = buildRedisAuthzCache();
        AuthzSdkImpl authzSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, cache);
        AuthzCacheEvictor evictor = new AuthzCacheEvictorImpl(cache);

        assertDoesNotThrow(() -> authzSdk.requireProjectId(testProjectId, "PROJECT-400", "PROJECT-400", "PROJECT-404"));
        assertEquals(ProjectRole.OWNER, authzSdk.requireRole(testUserId, testProjectId, Set.of(ProjectRole.OWNER)));
        assertEquals(true, authzSdk.authorize(testUserId, testProjectId, Action.EDIT).allowed());

        jdbcTemplate.update("delete from project_member where project_id = cast(? as uuid) and user_id = ?", testProjectId, testUserId);
        assertEquals(ProjectRole.OWNER, authzSdk.requireRole(testUserId, testProjectId, Set.of(ProjectRole.OWNER)));

        evictor.evictRole(testProjectId, testUserId);
        BizException ex = assertThrows(BizException.class,
                () -> authzSdk.requireRole(testUserId, testProjectId, Set.of(ProjectRole.OWNER)));
        assertEquals("PROJECT-403", ex.getCode());
    }

    @Test
    @DisplayName("固定知识库场景标识参与上下文时，不影响项目权限缓存逻辑")
    void fixedKbContext_shouldNotAffectProjectRoleCache() {
        AuthzSdkImpl authzSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, buildRedisAuthzCache());
        String invalid = testProjectId + "#kb-1";
        BizException ex = assertThrows(BizException.class,
                () -> authzSdk.requireProjectId(invalid, "PROJECT-400", "PROJECT-400", "PROJECT-404"));
        assertEquals("PROJECT-400", ex.getCode());
    }

    @Test
    @DisplayName("固定项目与用户：role 缓存 TTL 到期后应自动回源最新成员关系")
    void roleCache_shouldAutoReloadAfterTtlExpires() {
        AuthzSdkImpl authzSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, buildRedisAuthzCache(1));

        assertEquals(ProjectRole.OWNER, authzSdk.requireRole(testUserId, testProjectId, Set.of(ProjectRole.OWNER)));

        jdbcTemplate.update(
                "delete from project_member where project_id = cast(? as uuid) and user_id = ?",
                testProjectId, testUserId
        );
        sleepMillis(1200);

        BizException ex = assertThrows(BizException.class,
                () -> authzSdk.requireRole(testUserId, testProjectId, Set.of(ProjectRole.OWNER)));
        assertEquals("PROJECT-403", ex.getCode());
    }

    private AuthzQueryCache buildRedisAuthzCache() {
        return buildRedisAuthzCache(600);
    }

    private AuthzQueryCache buildRedisAuthzCache(int ttlSeconds) {
        AuthzCacheProperties authzCacheProperties = new AuthzCacheProperties();
        authzCacheProperties.setProjectExistsTtlSeconds(ttlSeconds);
        authzCacheProperties.setRoleTtlSeconds(ttlSeconds);
        authzCacheProperties.setProjectExistsNullTtlSeconds(Math.max(1, ttlSeconds));
        authzCacheProperties.setRoleNullTtlSeconds(Math.max(1, ttlSeconds));
        return new RedisAuthzQueryCache(redisCacheSupport, stringRedisTemplate, authzCacheProperties);
    }

    private void sleepMillis(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError("sleep interrupted", ex);
        }
    }
}
