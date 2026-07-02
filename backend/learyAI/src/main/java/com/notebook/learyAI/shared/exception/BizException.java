// Responsibility: Domain/application business exception with code.
package com.notebook.learyAI.shared.exception;

public class BizException extends RuntimeException {
    private final String code;

    public BizException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String getCode() {
        return code;
    }
}
