// Responsibility: Request payload for creating a register invite from admin.
package com.notebook.learyAI.module.admin.interfaces.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

public class AdminRegisterInviteCreateRequest {
    private String code;
    @Min(1)
    @Max(100)
    private Integer count;

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public Integer getCount() {
        return count;
    }

    public void setCount(Integer count) {
        this.count = count;
    }
}
