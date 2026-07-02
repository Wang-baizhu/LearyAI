// Responsibility: Cache preview STS credentials in Redis for kb docs.
package com.notebook.learyAI.module.kbdoc.infrastructure.cache;

import com.notebook.learyAI.shared.storage.StsCredentials;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@Component("redisPreviewStsCacheDelegate")
public class RedisPreviewStsCache implements PreviewStsCache {
    private static final String KEY_PREFIX = "STS:preview:";

    private final StringRedisTemplate stringRedisTemplate;

    public RedisPreviewStsCache(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @Override
    public Optional<StsCredentials> get(String provider, Long userId) {
        String key = key(provider, userId);
        Map<Object, Object> values = stringRedisTemplate.opsForHash().entries(key);
        if (values == null || values.isEmpty()) {
            return Optional.empty();
        }
        String accessKeyId = asString(values.get("accessKeyId"));
        String secretAccessKey = asString(values.get("secretAccessKey"));
        String sessionToken = asString(values.get("sessionToken"));
        String endpoint = asString(values.get("endpoint"));
        String bucket = asString(values.get("bucket"));
        String prefix = asString(values.get("prefix"));
        Instant expiresAt = parseInstant(values.get("expiresAt"));
        if (accessKeyId == null || secretAccessKey == null || sessionToken == null || expiresAt == null) {
            return Optional.empty();
        }
        String providerValue = asString(values.get("provider"));
        if (providerValue == null) {
            providerValue = normalize(provider);
        }
        return Optional.of(new StsCredentials(providerValue, accessKeyId, secretAccessKey, sessionToken,
                expiresAt, endpoint, bucket, prefix));
    }

    @Override
    public void put(String provider, Long userId, StsCredentials credentials, Duration ttl) {
        if (credentials == null || ttl == null || ttl.isNegative() || ttl.isZero()) {
            return;
        }
        String key = key(provider, userId);
        Map<String, String> values = new HashMap<>();
        values.put("provider", nullSafe(credentials.getProvider()));
        values.put("accessKeyId", nullSafe(credentials.getAccessKeyId()));
        values.put("secretAccessKey", nullSafe(credentials.getSecretAccessKey()));
        values.put("sessionToken", nullSafe(credentials.getSessionToken()));
        values.put("expiresAt", credentials.getExpiresAt() == null ? "" : String.valueOf(credentials.getExpiresAt().toEpochMilli()));
        values.put("endpoint", nullSafe(credentials.getEndpoint()));
        values.put("bucket", nullSafe(credentials.getBucket()));
        values.put("prefix", nullSafe(credentials.getPrefix()));
        stringRedisTemplate.opsForHash().putAll(key, values);
        stringRedisTemplate.expire(key, ttl);
    }

    private String key(String provider, Long userId) {
        return KEY_PREFIX + normalize(provider) + ":" + (userId == null ? "" : userId);
    }

    private String normalize(String value) {
        if (value == null) {
            return "";
        }
        return value.trim();
    }

    private String nullSafe(String value) {
        return value == null ? "" : value;
    }

    private String asString(Object value) {
        if (value == null) {
            return null;
        }
        String result = String.valueOf(value);
        return result.isBlank() ? null : result;
    }

    private Instant parseInstant(Object value) {
        String raw = asString(value);
        if (raw == null) {
            return null;
        }
        try {
            long epochMilli = Long.parseLong(raw);
            return Instant.ofEpochMilli(epochMilli);
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
