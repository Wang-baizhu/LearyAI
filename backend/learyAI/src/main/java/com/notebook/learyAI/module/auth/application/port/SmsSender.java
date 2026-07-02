// Responsibility: Send SMS verification codes via external provider.
package com.notebook.learyAI.module.auth.application.port;

public interface SmsSender {
    boolean send(String phone, String code);
}
