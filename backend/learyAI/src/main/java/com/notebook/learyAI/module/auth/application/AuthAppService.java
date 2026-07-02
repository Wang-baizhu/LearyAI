// Responsibility: Handle auth use cases (register, login, logout, me).
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.cache.AuthQueryCache;
import com.notebook.learyAI.module.auth.application.cache.CachedValue;
import com.notebook.learyAI.module.auth.application.port.LoginAttemptStore;
import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.model.RegisterInvite;
import com.notebook.learyAI.module.auth.domain.model.UserStatus;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.auth.domain.service.PasswordHasher;
import com.notebook.learyAI.module.project.application.ProjectAppService;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

@Service
public class AuthAppService {
    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;
    private final SessionAppService sessionAppService;
    private final LoginAttemptStore loginAttemptStore;
    private final SmsCodeAppService smsCodeAppService;
    private final AuthProperties authProperties;
    private final ProjectAppService projectAppService;
    private final AuthQueryCache authQueryCache;
    private final RegisterInviteAdminAppService registerInviteAdminAppService;

    public AuthAppService(UserRepository userRepository,
                          PasswordHasher passwordHasher,
                          SessionAppService sessionAppService,
                          LoginAttemptStore loginAttemptStore,
                          SmsCodeAppService smsCodeAppService,
                          AuthProperties authProperties,
                          ProjectAppService projectAppService,
                          AuthQueryCache authQueryCache,
                          RegisterInviteAdminAppService registerInviteAdminAppService) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
        this.sessionAppService = sessionAppService;
        this.loginAttemptStore = loginAttemptStore;
        this.smsCodeAppService = smsCodeAppService;
        this.authProperties = authProperties;
        this.projectAppService = projectAppService;
        this.authQueryCache = authQueryCache;
        this.registerInviteAdminAppService = registerInviteAdminAppService;
    }

    @Transactional
    public AuthResult register(String name, String email, String phone, String rawPassword, String smsCode,
                               boolean rememberMe, SessionClientInfo clientInfo) {
        if (userRepository.existsByEmail(email)) {
            throw new BizException("EMAIL_EXISTS", "注册失败：邮箱已注册");
        }
        if (userRepository.existsByPhone(phone)) {
            throw new BizException("PHONE_EXISTS", "注册失败：手机号已注册");
        }
        validatePassword(rawPassword);
        smsCodeAppService.verifyCode(phone, smsCode);

        Instant now = Instant.now();
        User user = new User(null, name, email, phone, passwordHasher.hash(rawPassword),
                UserStatus.ACTIVE, UserMode.FREE, now, now);
        User saved = userRepository.save(user);
        projectAppService.createInitialProject(saved.getId(), "个人");
        authQueryCache.evictMe(saved.getId());

        SessionResult session = sessionAppService.createSession(saved.getId(), rememberMe, clientInfo);
        return new AuthResult(toSummary(saved), session);
    }

    @Transactional
    public AuthResult registerWithInvite(String name,
                                         String email,
                                         String phone,
                                         String rawPassword,
                                         String inviteCode,
                                         boolean rememberMe,
                                         SessionClientInfo clientInfo) {
        if (userRepository.existsByEmail(email)) {
            throw new BizException("EMAIL_EXISTS", "注册失败：邮箱已注册");
        }
        if (userRepository.existsByPhone(phone)) {
            throw new BizException("PHONE_EXISTS", "注册失败：手机号已注册");
        }
        validatePassword(rawPassword);

        Instant now = Instant.now();
        User user = new User(null, name, email, phone, passwordHasher.hash(rawPassword),
                UserStatus.ACTIVE, UserMode.FREE, now, now);
        User saved = userRepository.save(user);
        registerInviteAdminAppService.claimInviteForRegistration(inviteCode, saved.getId(), now);
        projectAppService.createInitialProject(saved.getId(), "个人");
        authQueryCache.evictMe(saved.getId());

        SessionResult session = sessionAppService.createSession(saved.getId(), rememberMe, clientInfo);
        return new AuthResult(toSummary(saved), session);
    }

    @Transactional
    public AuthResult login(String email, String rawPassword, boolean rememberMe, SessionClientInfo clientInfo) {
        enforceLoginLimit(email);
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> recordLoginFailure(email));
        if (!passwordHasher.matches(rawPassword, user.getPasswordHash())) {
            throw recordLoginFailure(email);
        }
        loginAttemptStore.resetFailures(loginKey(email));

        User updated = user.withLastLoginAt(Instant.now());
        userRepository.save(updated);
        authQueryCache.evictMe(updated.getId());
        SessionResult session = sessionAppService.createSession(updated.getId(), rememberMe, clientInfo);
        return new AuthResult(toSummary(updated), session);
    }

    public void logout(String sessionId) {
        sessionAppService.deleteSession(sessionId);
    }

    public AuthUserSummary getCurrentUser() {
        Long userId = CurrentUserContext.getUserId();
        if (userId == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        CachedValue<AuthUserSummary> cached = authQueryCache.getMe(userId);
        if (cached.isHit()) {
            AuthUserSummary cachedUser = cached.getValue();
            if (cachedUser == null) {
                throw new BizException("USER_NOT_FOUND", "用户不存在");
            }
            return cachedUser;
        }
        User user = userRepository.findById(userId)
                .orElse(null);
        if (user == null) {
            authQueryCache.putMe(userId, null);
            throw new BizException("USER_NOT_FOUND", "用户不存在");
        }
        AuthUserSummary summary = toSummary(user);
        authQueryCache.putMe(userId, summary);
        return summary;
    }

    private void enforceLoginLimit(String email) {
        int maxFailures = authProperties.getLogin().getMaxFailures();
        int failures = loginAttemptStore.getFailures(loginKey(email)).orElse(0);
        if (failures >= maxFailures) {
            throw new BizException("LOGIN_LOCKED", "登录失败：登录被锁定，请稍后再试");
        }
    }

    private BizException recordLoginFailure(String email) {
        Duration ttl = Duration.ofMinutes(authProperties.getLogin().getLockMinutes());
        int failures = loginAttemptStore.incrementFailures(loginKey(email), ttl);
        if (failures >= authProperties.getLogin().getMaxFailures()) {
            return new BizException("LOGIN_LOCKED", "登录失败：登录被锁定，请稍后再试");
        }
        return new BizException("INVALID_CREDENTIALS", "登录失败：邮箱或密码输入错误");
    }

    private String loginKey(String email) {
        return "auth:login:failures:" + email.toLowerCase();
    }

    private void validatePassword(String rawPassword) {
        if (rawPassword == null || rawPassword.length() < 8) {
            throw new BizException("WEAK_PASSWORD", "注册失败：密码强度不足");
        }
    }

    private AuthUserSummary toSummary(User user) {
        return new AuthUserSummary(user.getId(), user.getName(), user.getEmail(), user.getPhone(), user.getUserMode().name());
    }
}
