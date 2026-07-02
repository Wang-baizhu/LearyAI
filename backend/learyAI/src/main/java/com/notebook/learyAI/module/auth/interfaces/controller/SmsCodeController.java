// Responsibility: Expose SMS code sending endpoint.
package com.notebook.learyAI.module.auth.interfaces.controller;

import com.notebook.learyAI.module.auth.application.SmsCodeAppService;
import com.notebook.learyAI.module.auth.interfaces.dto.SmsCodeRequest;
import com.notebook.learyAI.shared.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class SmsCodeController {
    private final SmsCodeAppService smsCodeAppService;

    public SmsCodeController(SmsCodeAppService smsCodeAppService) {
        this.smsCodeAppService = smsCodeAppService;
    }

    @PostMapping("/sms-code")
    public ApiResponse<Void> sendSmsCode(@Valid @RequestBody SmsCodeRequest request) {
        smsCodeAppService.sendCode(request.getPhone());
        return ApiResponse.ok("短信验证码发送成功", null);
    }
}
