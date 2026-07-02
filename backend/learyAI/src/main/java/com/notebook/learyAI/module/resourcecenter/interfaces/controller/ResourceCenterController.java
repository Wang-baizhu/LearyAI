// Responsibility: Expose resource center aggregate query endpoints.
package com.notebook.learyAI.module.resourcecenter.interfaces.controller;

import com.notebook.learyAI.module.resourcecenter.application.ResourceCenterOptionsAppService;
import com.notebook.learyAI.module.resourcecenter.interfaces.dto.ResourceCenterOptionsResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/resource-center")
public class ResourceCenterController {
    private final ResourceCenterOptionsAppService optionsAppService;

    public ResourceCenterController(ResourceCenterOptionsAppService optionsAppService) {
        this.optionsAppService = optionsAppService;
    }

    @GetMapping("/options")
    public ApiResponse<ResourceCenterOptionsResponse> options(@RequestParam String projectId,
                                                              @RequestParam String kbId) {
        return ApiResponse.ok("资源中心选项查询成功", optionsAppService.listOptions(projectId, kbId));
    }
}
