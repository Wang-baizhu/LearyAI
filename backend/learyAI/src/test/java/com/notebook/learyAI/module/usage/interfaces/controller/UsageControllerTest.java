// Responsibility: Verify self-service usage query endpoint contract and validation.
package com.notebook.learyAI.module.usage.interfaces.controller;

import com.notebook.learyAI.module.usage.application.service.UsageCurrentCycleQueryAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.shared.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.Instant;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class UsageControllerTest {
    private final UsageCurrentCycleQueryAppService usageCurrentCycleQueryAppService = mock(UsageCurrentCycleQueryAppService.class);

    @AfterEach
    void tearDown() {
        com.notebook.learyAI.shared.context.CurrentUserContext.clear();
    }

    @Test
    @DisplayName("GET /api/usage/current-cycle: 返回当前用户当前周期额度")
    void currentCycleUsage_shouldReturnItem() throws Exception {
        UsageController controller = new UsageController(usageCurrentCycleQueryAppService);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
        Instant now = Instant.parse("2026-06-19T00:00:00Z");
        when(usageCurrentCycleQueryAppService.getCurrentUserCycle("project-1", "ai_chat_tokens"))
                .thenReturn(new CurrentCycleUsage(
                        7L, "project-1", "ai_chat_tokens", 11L, 20L, 3L, 100L, 77L, now, now.plusSeconds(3600), now
                ));

        mockMvc.perform(get("/api/usage/current-cycle")
                        .param("projectId", "project-1")
                        .param("metric", "ai_chat_tokens"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.userId").value(7))
                .andExpect(jsonPath("$.data.available").value(77))
                .andExpect(jsonPath("$.data.metric").value("ai_chat_tokens"));
    }

}
