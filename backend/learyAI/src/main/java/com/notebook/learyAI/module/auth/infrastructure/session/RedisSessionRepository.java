// Responsibility: Store sessions in Redis with TTL support.
package com.notebook.learyAI.module.auth.infrastructure.session;

import com.notebook.learyAI.module.auth.domain.model.Session;
import com.notebook.learyAI.module.auth.domain.repository.SessionRepository;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Optional;

@Repository
public class RedisSessionRepository implements SessionRepository {
    private static final String PREFIX = "auth:session:";

    private final RedisTemplate<String, SessionRecord> sessionRedisTemplate;

    public RedisSessionRepository(RedisTemplate<String, SessionRecord> sessionRedisTemplate) {
        this.sessionRedisTemplate = sessionRedisTemplate;
    }

    @Override
    public void save(Session session, long ttlSeconds) {
        SessionRecord record = new SessionRecord(
                session.getSessionId(),
                session.getUserId(),
                session.getExpiresAt(),
                session.isRememberMe(),
                session.getIp(),
                session.getUserAgent(),
                session.getDeviceId()
        );
        sessionRedisTemplate.opsForValue().set(key(session.getSessionId()), record, Duration.ofSeconds(ttlSeconds));
    }

    @Override
    public Optional<Session> findById(String sessionId) {
        SessionRecord record = sessionRedisTemplate.opsForValue().get(key(sessionId));
        if (record == null) {
            return Optional.empty();
        }
        return Optional.of(new Session(record.getSessionId(), record.getUserId(), record.getExpiresAt(),
                record.isRememberMe(), record.getIp(), record.getUserAgent(), record.getDeviceId()));
    }

    @Override
    public void deleteById(String sessionId) {
        sessionRedisTemplate.delete(key(sessionId));
    }

    private String key(String sessionId) {
        return PREFIX + sessionId;
    }
}
