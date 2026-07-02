// Responsibility: Define persistence operations for SMS verification codes.
package com.notebook.learyAI.module.auth.application.port;

import java.time.Duration;
import java.util.Optional;

public interface SmsCodeStore {
    boolean acquireResendLock(String phone, Duration interval);

    void releaseResendLock(String phone);

    int incrementSendCount(String phone, Duration window);

    void decrementSendCount(String phone);

    void saveCode(String phone, String code, Duration ttl);

    Optional<String> getCode(String phone);

    void removeCode(String phone);
}
