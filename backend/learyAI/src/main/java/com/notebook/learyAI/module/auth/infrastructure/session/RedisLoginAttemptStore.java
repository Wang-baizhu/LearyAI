// Responsibility: Track login failures using Redis counters.
package com.notebook.learyAI.module.auth.infrastructure.session;

import com.notebook.learyAI.module.auth.application.port.LoginAttemptStore;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.util.Optional;

@Repository
public class RedisLoginAttemptStore implements LoginAttemptStore {
    private final StringRedisTemplate stringRedisTemplate;

    public RedisLoginAttemptStore(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @Override
    public int incrementFailures(String key, Duration ttl) {
        Long value = stringRedisTemplate.opsForValue().increment(key);
        if (value != null && value == 1L) {
            stringRedisTemplate.expire(key, ttl);
        }
        return value == null ? 0 : value.intValue();
    }

    @Override
    public Optional<Integer> getFailures(String key) {
        String value = stringRedisTemplate.opsForValue().get(key);
        if (value == null) {
            return Optional.empty();
        }
        try {
            return Optional.of(Integer.parseInt(value));
        } catch (NumberFormatException ex) {
            return Optional.empty();
        }
    }

    @Override
    public void resetFailures(String key) {
        stringRedisTemplate.delete(key);
    }
}
