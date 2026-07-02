// Responsibility: Provide shared Redis cache operations with jitter and after-commit eviction.
package com.notebook.learyAI.shared.cache;

import jakarta.annotation.PreDestroy;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Duration;
import java.util.Collection;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class RedisCacheSupport {
    public static final String NULL_MARKER = "__NULL__";

    private final StringRedisTemplate stringRedisTemplate;
    private final CacheCommonProperties properties;
    private final ScheduledExecutorService scheduler;

    public RedisCacheSupport(StringRedisTemplate stringRedisTemplate, CacheCommonProperties properties) {
        this.stringRedisTemplate = stringRedisTemplate;
        this.properties = properties;
        this.scheduler = Executors.newSingleThreadScheduledExecutor(new CacheThreadFactory());
    }

    public boolean isEnabled() {
        return properties.isEnabled();
    }

    public long defaultNullTtlSeconds() {
        return properties.getNullTtlSeconds();
    }

    public Optional<String> get(String key) {
        if (!isEnabled() || isBlank(key)) {
            return Optional.empty();
        }
        return Optional.ofNullable(stringRedisTemplate.opsForValue().get(key));
    }

    public void put(String key, String value, Duration ttl) {
        if (!isEnabled() || isBlank(key) || value == null || ttl == null || ttl.isZero() || ttl.isNegative()) {
            return;
        }
        stringRedisTemplate.opsForValue().set(key, value, jitter(ttl));
    }

    public void putNull(String key, Duration ttl) {
        put(key, NULL_MARKER, ttl);
    }

    public boolean isNullValue(String raw) {
        return NULL_MARKER.equals(raw);
    }

    public void delete(String key) {
        if (!isEnabled() || isBlank(key)) {
            return;
        }
        stringRedisTemplate.delete(key);
    }

    public void deleteAll(Collection<String> keys) {
        if (!isEnabled() || keys == null || keys.isEmpty()) {
            return;
        }
        stringRedisTemplate.delete(keys.stream().filter(Objects::nonNull).toList());
    }

    public void deleteAfterCommit(Collection<String> keys) {
        if (keys == null || keys.isEmpty()) {
            return;
        }
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    deleteAll(keys);
                    secondDelete(keys);
                }
            });
            return;
        }
        deleteAll(keys);
        secondDelete(keys);
    }

    public void deleteAfterCommit(String... keys) {
        if (keys == null || keys.length == 0) {
            return;
        }
        deleteAfterCommit(java.util.Arrays.asList(keys));
    }

    private void secondDelete(Collection<String> keys) {
        if (!isEnabled() || !properties.isSecondDeleteEnabled()) {
            return;
        }
        long delay = Math.max(properties.getSecondDeleteDelayMillis(), 0L);
        if (delay == 0) {
            deleteAll(keys);
            return;
        }
        scheduler.schedule(() -> deleteAll(keys), delay, TimeUnit.MILLISECONDS);
    }

    private Duration jitter(Duration ttl) {
        int percent = Math.max(0, properties.getJitterPercent());
        if (percent == 0) {
            return ttl;
        }
        long ttlMillis = ttl.toMillis();
        if (ttlMillis <= 10) {
            return ttl;
        }
        long maxOffset = ttlMillis * percent / 100;
        long offset = ThreadLocalRandom.current().nextLong(maxOffset + 1);
        return Duration.ofMillis(Math.max(1L, ttlMillis - offset));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    @PreDestroy
    public void destroy() {
        scheduler.shutdownNow();
    }

    private static class CacheThreadFactory implements ThreadFactory {
        @Override
        public Thread newThread(Runnable r) {
            Thread thread = new Thread(r);
            thread.setName("redis-cache-second-delete");
            thread.setDaemon(true);
            return thread;
        }
    }
}
