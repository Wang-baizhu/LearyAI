// Responsibility: Verify AuthAppService registration/login core branches and lock rules.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.cache.AuthQueryCache;
import com.notebook.learyAI.module.auth.application.cache.CachedValue;
import com.notebook.learyAI.module.auth.application.port.LoginAttemptStore;
import com.notebook.learyAI.module.auth.domain.model.RegisterInvite;
import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;
import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.domain.model.UserStatus;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.auth.domain.service.PasswordHasher;
import com.notebook.learyAI.module.project.application.ProjectAppService;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthAppServiceTest {
    @Mock
    private UserRepository userRepository;
    @Mock
    private PasswordHasher passwordHasher;
    @Mock
    private SessionAppService sessionAppService;
    @Mock
    private LoginAttemptStore loginAttemptStore;
    @Mock
    private SmsCodeAppService smsCodeAppService;
    @Mock
    private ProjectAppService projectAppService;
    @Mock
    private RegisterInviteAdminAppService registerInviteAdminAppService;

    private AuthAppService authAppService;

    @BeforeEach
    void setUp() {
        AuthProperties props = new AuthProperties();
        props.getLogin().setMaxFailures(3);
        props.getLogin().setLockMinutes(10);
        authAppService = new AuthAppService(
                userRepository,
                passwordHasher,
                sessionAppService,
                loginAttemptStore,
                smsCodeAppService,
                props,
                projectAppService,
                new InMemoryAuthQueryCache(),
                registerInviteAdminAppService
        );
    }

    @Test
    @DisplayName("register: 邮箱已存在时返回 EMAIL_EXISTS")
    void register_whenEmailExists_shouldThrowEmailExists() {
        when(userRepository.existsByEmail("x@test.com")).thenReturn(true);

        BizException ex = assertThrows(BizException.class,
                () -> authAppService.register("u", "x@test.com", "13800000000", "password1",
                        "1234", false, new SessionClientInfo("127.0.0.1", "ua", "d1")));

        assertEquals("EMAIL_EXISTS", ex.getCode());
        verify(userRepository, never()).existsByPhone(any());
    }

    @Test
    @DisplayName("register: 手机号已存在时返回 PHONE_EXISTS")
    void register_whenPhoneExists_shouldThrowPhoneExists() {
        when(userRepository.existsByEmail("x@test.com")).thenReturn(false);
        when(userRepository.existsByPhone("13800000000")).thenReturn(true);

        BizException ex = assertThrows(BizException.class,
                () -> authAppService.register("u", "x@test.com", "13800000000", "password1",
                        "1234", false, new SessionClientInfo("127.0.0.1", "ua", "d1")));

        assertEquals("PHONE_EXISTS", ex.getCode());
    }

    @Test
    @DisplayName("register: 密码长度不足时返回 WEAK_PASSWORD")
    void register_whenWeakPassword_shouldThrowWeakPassword() {
        when(userRepository.existsByEmail("x@test.com")).thenReturn(false);
        when(userRepository.existsByPhone("13800000000")).thenReturn(false);

        BizException ex = assertThrows(BizException.class,
                () -> authAppService.register("u", "x@test.com", "13800000000", "1234567",
                        "1234", false, new SessionClientInfo("127.0.0.1", "ua", "d1")));

        assertEquals("WEAK_PASSWORD", ex.getCode());
    }

    @Test
    @DisplayName("register: 成功时应创建用户/初始项目/会话")
    void register_success_shouldCreateUserProjectAndSession() {
        when(userRepository.existsByEmail("new@test.com")).thenReturn(false);
        when(userRepository.existsByPhone("13800000001")).thenReturn(false);
        when(passwordHasher.hash("password1")).thenReturn("hashed-pwd");
        User saved = new User(9L, "new", "new@test.com", "13800000001", "hashed-pwd",
                UserStatus.ACTIVE, UserMode.FREE, Instant.now(), Instant.now());
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(sessionAppService.createSession(eq(9L), eq(true), any(SessionClientInfo.class)))
                .thenReturn(new SessionResult("sid-9", 7200));

        AuthResult result = authAppService.register("new", "new@test.com", "13800000001", "password1",
                "1234", true, new SessionClientInfo("127.0.0.1", "ua", "d1"));

        assertEquals(9L, result.getUser().getUserId());
        assertEquals("new", result.getUser().getName());
        assertEquals("sid-9", result.getSession().getSessionId());
        verify(smsCodeAppService).verifyCode("13800000001", "1234");
        verify(projectAppService).createInitialProject(9L, "个人");
    }

    @Test
    @DisplayName("register: 密码为空时返回 WEAK_PASSWORD")
    void register_whenPasswordNull_shouldThrowWeakPassword() {
        when(userRepository.existsByEmail("x@test.com")).thenReturn(false);
        when(userRepository.existsByPhone("13800000000")).thenReturn(false);

        BizException ex = assertThrows(BizException.class,
                () -> authAppService.register("u", "x@test.com", "13800000000", null,
                        "1234", false, new SessionClientInfo("127.0.0.1", "ua", "d1")));

        assertEquals("WEAK_PASSWORD", ex.getCode());
    }

    @Test
    @DisplayName("registerWithInvite: 成功时应校验邀请码并创建用户/项目/会话")
    void registerWithInvite_success_shouldClaimInviteAndCreateSession() {
        when(userRepository.existsByEmail("invite@test.com")).thenReturn(false);
        when(userRepository.existsByPhone("13800000009")).thenReturn(false);
        when(passwordHasher.hash("password1")).thenReturn("hashed-pwd");
        User saved = new User(19L, "invite", "invite@test.com", "13800000009", "hashed-pwd",
                UserStatus.ACTIVE, UserMode.FREE, Instant.now(), Instant.now());
        when(userRepository.save(any(User.class))).thenReturn(saved);
        when(registerInviteAdminAppService.claimInviteForRegistration(eq("invite-001"), eq(19L), any()))
                .thenReturn(new RegisterInvite(1L, "INVITE-001", RegisterInviteStatus.USED, 1L, 19L,
                        Instant.now(), Instant.now(), Instant.now()));
        when(sessionAppService.createSession(eq(19L), eq(true), any(SessionClientInfo.class)))
                .thenReturn(new SessionResult("sid-19", 7200));

        AuthResult result = authAppService.registerWithInvite("invite", "invite@test.com", "13800000009", "password1",
                "invite-001", true, new SessionClientInfo("127.0.0.1", "ua", "d1"));

        assertEquals(19L, result.getUser().getUserId());
        assertEquals("sid-19", result.getSession().getSessionId());
        verify(registerInviteAdminAppService).claimInviteForRegistration(eq("invite-001"), eq(19L), any());
        verify(projectAppService).createInitialProject(19L, "个人");
        verify(smsCodeAppService, never()).verifyCode(any(), any());
    }

    @Test
    @DisplayName("login: 失败次数达到阈值时返回 LOGIN_LOCKED")
    void login_whenFailuresReached_shouldThrowLoginLocked() {
        when(loginAttemptStore.getFailures("auth:login:failures:a@test.com")).thenReturn(Optional.of(3));

        BizException ex = assertThrows(BizException.class,
                () -> authAppService.login("a@test.com", "password1", false,
                        new SessionClientInfo("127.0.0.1", "ua", "d1")));

        assertEquals("LOGIN_LOCKED", ex.getCode());
    }

    @Test
    @DisplayName("login: 密码错误时递增失败次数并返回 INVALID_CREDENTIALS")
    void login_whenPasswordMismatch_shouldRecordFailure() {
        User user = new User(1L, "u", "a@test.com", "13800000000", "hash",
                UserStatus.ACTIVE, UserMode.FREE, Instant.now(), Instant.now());
        when(loginAttemptStore.getFailures("auth:login:failures:a@test.com")).thenReturn(Optional.of(0));
        when(userRepository.findByEmail("a@test.com")).thenReturn(Optional.of(user));
        when(passwordHasher.matches("bad-pass", "hash")).thenReturn(false);
        when(loginAttemptStore.incrementFailures(any(), any())).thenReturn(1);

        BizException ex = assertThrows(BizException.class,
                () -> authAppService.login("a@test.com", "bad-pass", false,
                        new SessionClientInfo("127.0.0.1", "ua", "d1")));

        assertEquals("INVALID_CREDENTIALS", ex.getCode());
    }

    @Test
    @DisplayName("login: 成功时应重置失败计数并创建会话")
    void login_success_shouldResetFailuresAndCreateSession() {
        User user = new User(10L, "u", "ok@test.com", "13800000000", "hash",
                UserStatus.ACTIVE, UserMode.FREE, Instant.now(), Instant.now().minusSeconds(60));
        when(loginAttemptStore.getFailures("auth:login:failures:ok@test.com")).thenReturn(Optional.of(0));
        when(userRepository.findByEmail("ok@test.com")).thenReturn(Optional.of(user));
        when(passwordHasher.matches("password1", "hash")).thenReturn(true);
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(sessionAppService.createSession(any(), any(Boolean.class), any()))
                .thenReturn(new SessionResult("sid-ok", 1800));

        AuthResult result = authAppService.login("ok@test.com", "password1", false,
                new SessionClientInfo("127.0.0.1", "ua", "d1"));

        assertNotNull(result.getUser());
        assertEquals("sid-ok", result.getSession().getSessionId());
        verify(loginAttemptStore).resetFailures("auth:login:failures:ok@test.com");
        verify(userRepository).save(any(User.class));
    }

    @Test
    @DisplayName("logout: 应透传 sessionId 到 SessionAppService")
    void logout_shouldDelegateDeleteSession() {
        authAppService.logout("sid-del");
        verify(sessionAppService).deleteSession("sid-del");
    }

    @Test
    @DisplayName("getCurrentUser: 未登录时返回 UNAUTHORIZED")
    void getCurrentUser_whenNoCurrentUser_shouldThrowUnauthorized() {
        BizException ex = assertThrows(BizException.class, authAppService::getCurrentUser);
        assertEquals("UNAUTHORIZED", ex.getCode());
        verify(userRepository, never()).findById(any());
    }

    private static class InMemoryAuthQueryCache implements AuthQueryCache {
        private final Map<Long, AuthUserSummary> meMap = new ConcurrentHashMap<>();

        @Override
        public CachedValue<AuthUserSummary> getMe(long userId) {
            if (!meMap.containsKey(userId)) {
                return CachedValue.miss();
            }
            return CachedValue.hit(meMap.get(userId));
        }

        @Override
        public void putMe(long userId, AuthUserSummary summary) {
            meMap.put(userId, summary);
        }

        @Override
        public void evictMe(long userId) {
            meMap.remove(userId);
        }
    }
}
