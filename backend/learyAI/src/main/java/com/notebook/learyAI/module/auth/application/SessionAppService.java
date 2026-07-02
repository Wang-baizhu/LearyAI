// Responsibility: Manage session creation, lookup, renewal, and removal.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.domain.model.Session;
import com.notebook.learyAI.module.auth.domain.repository.SessionRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class SessionAppService {
    private final SessionRepository sessionRepository;
    private final AuthPolicy authPolicy;
    private final AuthProperties authProperties;

    public SessionAppService(SessionRepository sessionRepository, AuthPolicy authPolicy, AuthProperties authProperties) {
        this.sessionRepository = sessionRepository;
        this.authPolicy = authPolicy;
        this.authProperties = authProperties;
    }

    public SessionResult createSession(Long userId, boolean rememberMe, SessionClientInfo clientInfo) {
        String sessionId = UUID.randomUUID().toString();
        long ttlSeconds = authPolicy.resolveSessionTtlSeconds(rememberMe);
        Instant expiresAt = Instant.now().plusSeconds(ttlSeconds);
        Session session = new Session(sessionId, userId, expiresAt, rememberMe,
                clientInfo.getIp(), clientInfo.getUserAgent(), clientInfo.getDeviceId());
        sessionRepository.save(session, ttlSeconds);
        long cookieMaxAge = rememberMe ? ttlSeconds : -1;
        return new SessionResult(sessionId, cookieMaxAge);
    }

    public Optional<Session> resolveSession(String sessionId) {
        if (sessionId == null) {
            return Optional.empty();
        }
        Optional<Session> sessionOpt = sessionRepository.findById(sessionId);
        if (sessionOpt.isEmpty()) {
            return resolveTestBypass(sessionId);
        }
        Session session = sessionOpt.get();
        Instant now = Instant.now();
        if (session.getExpiresAt().isBefore(now)) {
            sessionRepository.deleteById(sessionId);
            return Optional.empty();
        }
        if (authPolicy.shouldRenew(session.isRememberMe(), session.getExpiresAt(), now)) {
            Session renewed = session.withExpiresAt(authPolicy.renewExpiry(now));
            long ttlSeconds = authPolicy.resolveSessionTtlSeconds(false);
            sessionRepository.save(renewed, ttlSeconds);
            return Optional.of(renewed);
        }
        return Optional.of(session);
    }

    private Optional<Session> resolveTestBypass(String sessionId) {
        AuthProperties.Session sessionConfig = authProperties.getSession();
        if (!sessionConfig.isTestBypassEnabled()) {
            return Optional.empty();
        }
        String bypassId = sessionConfig.getTestBypassSessionId();
        Long bypassUserId = sessionConfig.getTestBypassUserId();
        if (bypassId == null || !bypassId.equals(sessionId) || bypassUserId == null) {
            return Optional.empty();
        }
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(authPolicy.resolveSessionTtlSeconds(false));
        Session session = new Session(sessionId, bypassUserId, expiresAt, false, "test", "test", "test");
        return Optional.of(session);
    }

    public void deleteSession(String sessionId) {
        sessionRepository.deleteById(sessionId);
    }
}
