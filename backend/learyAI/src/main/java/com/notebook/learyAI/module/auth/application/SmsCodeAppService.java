// Responsibility: Orchestrate SMS verification code sending and validation.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.port.SmsCodeStore;
import com.notebook.learyAI.module.auth.application.port.SmsSender;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Optional;

@Service
public class SmsCodeAppService {
    private final SmsCodeStore smsCodeStore;
    private final SmsSender smsSender;
    private final AuthProperties authProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    public SmsCodeAppService(SmsCodeStore smsCodeStore, SmsSender smsSender, AuthProperties authProperties) {
        this.smsCodeStore = smsCodeStore;
        this.smsSender = smsSender;
        this.authProperties = authProperties;
    }

    public void sendCode(String phone) {
        if (phone == null || phone.isBlank()) {
            throw new BizException("PHONE_REQUIRED", "发送验证码失败：手机号不能为空");
        }
        AuthProperties.Sms sms = authProperties.getSms();
        Duration resendInterval = Duration.ofSeconds(sms.getResendIntervalSeconds());
        Duration window = Duration.ofSeconds(sms.getLimitWindowSeconds());
        Duration ttl = Duration.ofSeconds(sms.getCodeTtlSeconds());
        int maxPerWindow = Math.max(1, sms.getMaxPerWindow());
        int codeLength = Math.max(4, sms.getCodeLength());

        if (!smsCodeStore.acquireResendLock(phone, resendInterval)) {
            throw new BizException("SMS_TOO_FREQUENT", "发送验证码失败：短信请求过于频繁");
        }
        int count = smsCodeStore.incrementSendCount(phone, window);
        if (count > maxPerWindow) {
            smsCodeStore.releaseResendLock(phone);
            smsCodeStore.decrementSendCount(phone);
            throw new BizException("SMS_LIMIT_EXCEEDED", "发送验证码失败：短信发送次数已达上限");
        }

        String code = generateCode(codeLength);
        if (!smsSender.send(phone, code)) {
            smsCodeStore.releaseResendLock(phone);
            smsCodeStore.decrementSendCount(phone);
            throw new BizException("SMS_SEND_FAILED", "发送验证码失败：短信发送失败，请确保手机号有效");
        }

        smsCodeStore.saveCode(phone, code, ttl);
    }

    public void verifyCode(String phone, String smsCode) {
        if (smsCode == null || smsCode.isBlank()) {
            throw new BizException("SMS_CODE_REQUIRED", "注册失败：请输入短信验证码");
        }
        Optional<String> code = smsCodeStore.getCode(phone);
        if (code.isEmpty()) {
            throw new BizException("SMS_CODE_EXPIRED", "注册失败：短信验证码已过期");
        }
        if (!code.get().equals(smsCode)) {
            throw new BizException("SMS_CODE_INVALID", "注册失败：短信验证码无效");
        }
        smsCodeStore.removeCode(phone);
    }

    private String generateCode(int length) {
        StringBuilder builder = new StringBuilder(length);
        for (int i = 0; i < length; i++) {
            builder.append(secureRandom.nextInt(10));
        }
        return builder.toString();
    }
}
