// Responsibility: Store SMS verification codes and rate limits in Redis.
package com.notebook.learyAI.module.auth.infrastructure.sms;

import com.notebook.learyAI.module.auth.application.port.SmsCodeStore;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;

@Component
public class RedisSmsCodeStore implements SmsCodeStore {
    private final StringRedisTemplate stringRedisTemplate;

    public RedisSmsCodeStore(StringRedisTemplate stringRedisTemplate) {
        this.stringRedisTemplate = stringRedisTemplate;
    }

    @Override
    public boolean acquireResendLock(String phone, Duration interval) {
        Boolean success = stringRedisTemplate.opsForValue()
                .setIfAbsent(resendKey(phone), "1", interval);
        return Boolean.TRUE.equals(success);
    }

    @Override
    public void releaseResendLock(String phone) {
        stringRedisTemplate.delete(resendKey(phone));
    }

    @Override
    public int incrementSendCount(String phone, Duration window) {
        String key = countKey(phone);
        Long value = stringRedisTemplate.opsForValue().increment(key);
        if (value != null && value == 1L) {
            stringRedisTemplate.expire(key, window);
        }
        return value == null ? 0 : value.intValue();
    }

    @Override
    public void decrementSendCount(String phone) {
        stringRedisTemplate.opsForValue().decrement(countKey(phone));
    }

    @Override
    public void saveCode(String phone, String code, Duration ttl) {
        stringRedisTemplate.opsForValue().set(codeKey(phone), code, ttl);
    }

    @Override
    public Optional<String> getCode(String phone) {
        return Optional.ofNullable(stringRedisTemplate.opsForValue().get(codeKey(phone)));
    }

    @Override
    public void removeCode(String phone) {
        stringRedisTemplate.delete(codeKey(phone));
    }

    private String codeKey(String phone) {
        return "auth:sms:code:" + phone;
    }

    private String resendKey(String phone) {
        return "auth:sms:resend:" + phone;
    }

    private String countKey(String phone) {
        return "auth:sms:count:" + phone;
    }
}
