// Responsibility: Verify SmsCodeController delegates SMS send requests.
package com.notebook.learyAI.module.auth.interfaces.controller;

import com.notebook.learyAI.module.auth.application.SmsCodeAppService;
import com.notebook.learyAI.module.auth.interfaces.dto.SmsCodeRequest;
import com.notebook.learyAI.shared.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class SmsCodeControllerTest {
    @Mock
    private SmsCodeAppService smsCodeAppService;

    @Test
    @DisplayName("sendSmsCode 应调用应用服务并返回 OK")
    void sendSmsCode_shouldDelegateToAppService() {
        SmsCodeController controller = new SmsCodeController(smsCodeAppService);
        SmsCodeRequest request = new SmsCodeRequest();
        request.setPhone("13800000000");

        var result = controller.sendSmsCode(request);

        verify(smsCodeAppService).sendCode("13800000000");
        assertEquals("OK", result.getCode());
    }

    @Test
    @DisplayName("sendSmsCode 手机号为空时应返回 VALIDATION_ERROR")
    void sendSmsCode_blankPhone_shouldReturnValidationError() throws Exception {
        SmsCodeController controller = new SmsCodeController(smsCodeAppService);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();

        mockMvc.perform(post("/api/auth/sms-code")
                        .contentType("application/json")
                        .content("{\"phone\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        verifyNoInteractions(smsCodeAppService);
    }
}
