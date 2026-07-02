// Responsibility: Verify auth me cache hit/evict/reload flow with real PostgreSQL and Redis.
package com.notebook.learyAI.module.auth.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.cache.AuthQueryCache;
import com.notebook.learyAI.module.auth.application.port.LoginAttemptStore;
import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.domain.model.UserStatus;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.auth.domain.service.PasswordHasher;
import com.notebook.learyAI.module.auth.infrastructure.cache.AuthCacheProperties;
import com.notebook.learyAI.module.auth.infrastructure.cache.RedisAuthQueryCache;
import com.notebook.learyAI.module.project.application.ProjectAppService;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import com.notebook.learyAI.shared.cache.CacheCommonProperties;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class AuthMeCacheIntegrationFlowTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private UserRepository userRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private RedisCacheSupport redisCacheSupport;
    private AuthAppService authAppService;
    private long testUserId;

    @BeforeEach
    void setUp() {
        testUserId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        CurrentUserContext.setUserId(testUserId);

        CacheCommonProperties commonProperties = new CacheCommonProperties();
        commonProperties.setEnabled(true);
        commonProperties.setJitterPercent(0);
        commonProperties.setSecondDeleteEnabled(false);
        redisCacheSupport = new RedisCacheSupport(stringRedisTemplate, commonProperties);

        AuthCacheProperties authCacheProperties = new AuthCacheProperties();
        authCacheProperties.setMeTtlSeconds(600);
        authCacheProperties.setMeNullTtlSeconds(120);
        AuthQueryCache authQueryCache = new RedisAuthQueryCache(redisCacheSupport, new ObjectMapper(), authCacheProperties);

        PasswordHasher passwordHasher = mock(PasswordHasher.class);
        SessionAppService sessionAppService = mock(SessionAppService.class);
        LoginAttemptStore loginAttemptStore = mock(LoginAttemptStore.class);
        SmsCodeAppService smsCodeAppService = mock(SmsCodeAppService.class);
        AuthProperties authProperties = mock(AuthProperties.class);
        ProjectAppService projectAppService = mock(ProjectAppService.class);

        authAppService = new AuthAppService(
                userRepository,
                passwordHasher,
                sessionAppService,
                loginAttemptStore,
                smsCodeAppService,
                authProperties,
                projectAppService,
                authQueryCache,
                mock(RegisterInviteAdminAppService.class)
        );
    }

    private static String phoneOf(long seed) {
        return String.format("139%08d", Math.floorMod(seed, 100_000_000L));
    }

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
        stringRedisTemplate.delete("auth:me:" + testUserId);
        if (redisCacheSupport != null) {
            redisCacheSupport.destroy();
        }
        jdbcTemplate.update("delete from auth_user where id = ?", testUserId);
    }

    @Test
    @DisplayName("固定用户：首次回源后应命中缓存，减少重复查库")
    void fixedUser_shouldUseCacheAfterFirstDbLoad() {
        Instant now = Instant.now();
        User saved = userRepository.save(new User(null, "u1", "u1@test.com", phoneOf(testUserId), "hash",
                UserStatus.ACTIVE, UserMode.FREE, now, now));
        testUserId = saved.getId();
        CurrentUserContext.setUserId(testUserId);

        AuthUserSummary first = authAppService.getCurrentUser();
        jdbcTemplate.update("delete from auth_user where id = ?", testUserId);
        AuthUserSummary second = authAppService.getCurrentUser();

        assertEquals("u1", first.getName());
        assertEquals("u1", second.getName());
    }

    @Test
    @DisplayName("固定用户：缓存命中时不应再次访问数据库")
    void fixedUser_whenCacheHit_shouldNotQueryRepositoryAgain() {
        stringRedisTemplate.opsForValue().set(
                "auth:me:" + testUserId,
                "{\"userId\":" + testUserId + ",\"name\":\"cached\",\"email\":\"c@test.com\",\"phone\":\"13900000000\",\"userMode\":\"FREE\"}"
        );

        AuthUserSummary result = authAppService.getCurrentUser();

        assertEquals("cached", result.getName());
    }

    @Test
    @DisplayName("固定用户：用户不存在时应空值缓存，后续查询不重复回源")
    void fixedUser_whenUserNotFound_shouldCacheNullAndAvoidPenetration() {
        BizException ex1 = assertThrows(BizException.class, () -> authAppService.getCurrentUser());
        assertEquals("USER_NOT_FOUND", ex1.getCode());

        Instant now = Instant.now();
        jdbcTemplate.update(
                "insert into auth_user(id, name, email, phone, password_hash, status, user_mode, created_at, last_login_at)"
                        + " values (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                testUserId, "u2", "u2@test.com", phoneOf(testUserId), "hash",
                "ACTIVE", "FREE", Timestamp.from(now), Timestamp.from(now)
        );
        BizException ex2 = assertThrows(BizException.class, () -> authAppService.getCurrentUser());
        assertEquals("USER_NOT_FOUND", ex2.getCode());
    }
}
