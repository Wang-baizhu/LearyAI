// Responsibility: Verify SmsCodeAppService send/verify core branches and error semantics.
package com.notebook.learyAI.module.auth.application;

import com.notebook.learyAI.config.AuthProperties;
import com.notebook.learyAI.module.auth.application.port.SmsCodeStore;
import com.notebook.learyAI.module.auth.application.port.SmsSender;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SmsCodeAppServiceTest {
    @Mock
    private SmsCodeStore smsCodeStore;
    @Mock
    private SmsSender smsSender;

    private SmsCodeAppService smsCodeAppService;

    @BeforeEach
    void setUp() {
        AuthProperties props = new AuthProperties();
        props.getSms().setCodeLength(6);
        props.getSms().setCodeTtlSeconds(300);
        props.getSms().setResendIntervalSeconds(60);
        props.getSms().setLimitWindowSeconds(3600);
        props.getSms().setMaxPerWindow(3);
        smsCodeAppService = new SmsCodeAppService(smsCodeStore, smsSender, props);
    }

    @Test
    @DisplayName("sendCode 在手机号为空时应抛出 PHONE_REQUIRED")
    void sendCode_blankPhone_shouldThrowPhoneRequired() {
        BizException ex = assertThrows(BizException.class, () -> smsCodeAppService.sendCode(" "));
        assertEquals("PHONE_REQUIRED", ex.getCode());
    }

    @Test
    @DisplayName("sendCode 在重发锁失败时应抛出 SMS_TOO_FREQUENT")
    void sendCode_resendLockFailed_shouldThrowTooFrequent() {
        when(smsCodeStore.acquireResendLock("13800000000", Duration.ofSeconds(60))).thenReturn(false);

        BizException ex = assertThrows(BizException.class, () -> smsCodeAppService.sendCode("13800000000"));

        assertEquals("SMS_TOO_FREQUENT", ex.getCode());
    }

    @Test
    @DisplayName("sendCode 达到窗口上限时应回滚计数并抛出 SMS_LIMIT_EXCEEDED")
    void sendCode_limitExceeded_shouldRollbackAndThrow() {
        when(smsCodeStore.acquireResendLock("13800000000", Duration.ofSeconds(60))).thenReturn(true);
        when(smsCodeStore.incrementSendCount("13800000000", Duration.ofSeconds(3600))).thenReturn(4);

        BizException ex = assertThrows(BizException.class, () -> smsCodeAppService.sendCode("13800000000"));

        assertEquals("SMS_LIMIT_EXCEEDED", ex.getCode());
        verify(smsCodeStore).releaseResendLock("13800000000");
        verify(smsCodeStore).decrementSendCount("13800000000");
    }

    @Test
    @DisplayName("sendCode 成功发送时应写入验证码且 TTL 正确")
    void sendCode_success_shouldPersistCodeWithTtl() {
        when(smsCodeStore.acquireResendLock("13800000000", Duration.ofSeconds(60))).thenReturn(true);
        when(smsCodeStore.incrementSendCount("13800000000", Duration.ofSeconds(3600))).thenReturn(1);
        when(smsSender.send(eq("13800000000"), any())).thenReturn(true);

        smsCodeAppService.sendCode("13800000000");

        ArgumentCaptor<String> codeCaptor = ArgumentCaptor.forClass(String.class);
        verify(smsSender).send(eq("13800000000"), codeCaptor.capture());
        assertEquals(6, codeCaptor.getValue().length());
        verify(smsCodeStore).saveCode("13800000000", codeCaptor.getValue(), Duration.ofSeconds(300));
    }

    @Test
    @DisplayName("sendCode 短信通道失败时应回滚并抛出 SMS_SEND_FAILED")
    void sendCode_whenSmsSenderFailed_shouldRollbackAndThrow() {
        when(smsCodeStore.acquireResendLock("13800000000", Duration.ofSeconds(60))).thenReturn(true);
        when(smsCodeStore.incrementSendCount("13800000000", Duration.ofSeconds(3600))).thenReturn(1);
        when(smsSender.send(eq("13800000000"), any())).thenReturn(false);

        BizException ex = assertThrows(BizException.class, () -> smsCodeAppService.sendCode("13800000000"));

        assertEquals("SMS_SEND_FAILED", ex.getCode());
        verify(smsCodeStore).releaseResendLock("13800000000");
        verify(smsCodeStore).decrementSendCount("13800000000");
    }

    @Test
    @DisplayName("verifyCode 为空时应抛出 SMS_CODE_REQUIRED")
    void verifyCode_blank_shouldThrowRequired() {
        BizException ex = assertThrows(BizException.class, () -> smsCodeAppService.verifyCode("13800000000", " "));
        assertEquals("SMS_CODE_REQUIRED", ex.getCode());
    }

    @Test
    @DisplayName("verifyCode 过期时应抛出 SMS_CODE_EXPIRED")
    void verifyCode_expired_shouldThrowExpired() {
        when(smsCodeStore.getCode("13800000000")).thenReturn(Optional.empty());

        BizException ex = assertThrows(BizException.class,
                () -> smsCodeAppService.verifyCode("13800000000", "123456"));
        assertEquals("SMS_CODE_EXPIRED", ex.getCode());
    }

    @Test
    @DisplayName("verifyCode 错误时应抛出 SMS_CODE_INVALID")
    void verifyCode_invalid_shouldThrowInvalid() {
        when(smsCodeStore.getCode("13800000000")).thenReturn(Optional.of("654321"));

        BizException ex = assertThrows(BizException.class,
                () -> smsCodeAppService.verifyCode("13800000000", "123456"));
        assertEquals("SMS_CODE_INVALID", ex.getCode());
    }

    @Test
    @DisplayName("verifyCode 成功时应删除验证码")
    void verifyCode_success_shouldRemoveCode() {
        when(smsCodeStore.getCode("13800000000")).thenReturn(Optional.of("123456"));

        smsCodeAppService.verifyCode("13800000000", "123456");

        verify(smsCodeStore).removeCode("13800000000");
    }
}
