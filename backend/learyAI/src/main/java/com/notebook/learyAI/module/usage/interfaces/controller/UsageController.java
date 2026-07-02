// Responsibility: Expose authenticated self-service usage query endpoints.
package com.notebook.learyAI.module.usage.interfaces.controller;

import com.notebook.learyAI.module.usage.application.service.UsageCurrentCycleQueryAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.interfaces.dto.UsageCurrentCycleResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/usage")
public class UsageController {
    private final UsageCurrentCycleQueryAppService usageCurrentCycleQueryAppService;

    public UsageController(UsageCurrentCycleQueryAppService usageCurrentCycleQueryAppService) {
        this.usageCurrentCycleQueryAppService = usageCurrentCycleQueryAppService;
    }

    @GetMapping("/current-cycle")
    public ApiResponse<UsageCurrentCycleResponse> currentCycleUsage(@RequestParam @NotBlank String projectId,
                                                                    @RequestParam @NotBlank String metric) {
        CurrentCycleUsage usage = usageCurrentCycleQueryAppService.getCurrentUserCycle(projectId, metric);
        return ApiResponse.ok("当前周期额度查询成功", toResponse(usage));
    }

    private UsageCurrentCycleResponse toResponse(CurrentCycleUsage usage) {
        return new UsageCurrentCycleResponse(
                usage.userId(),
                usage.projectId(),
                usage.metric(),
                usage.cycleId(),
                usage.used(),
                usage.reserved(),
                usage.quota(),
                usage.available(),
                usage.validFrom(),
                usage.validTo(),
                usage.updatedAt()
        );
    }
}
