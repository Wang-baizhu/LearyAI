// Responsibility: Expose kb skill token issuance endpoint.
package com.notebook.learyAI.module.skills.interfaces.controller;

import com.notebook.learyAI.module.skills.application.KbSkillTokenAppService;
import com.notebook.learyAI.module.skills.application.KbSkillSearchAppService;
import com.notebook.learyAI.module.skills.application.KbSkillSearchWaitService;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillTokenCreateRequest;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillSearchRequest;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillSearchResponse;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillTokenResponse;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.shared.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;

@RestController
@RequestMapping("/api/skills")
public class KbSkillTokenController {
    private final KbSkillTokenAppService kbSkillTokenAppService;
    private final KbSkillSearchAppService kbSkillSearchAppService;
    private final KbSkillSearchWaitService kbSkillSearchWaitService;

    public KbSkillTokenController(KbSkillTokenAppService kbSkillTokenAppService,
                                  KbSkillSearchAppService kbSkillSearchAppService,
                                  KbSkillSearchWaitService kbSkillSearchWaitService) {
        this.kbSkillTokenAppService = kbSkillTokenAppService;
        this.kbSkillSearchAppService = kbSkillSearchAppService;
        this.kbSkillSearchWaitService = kbSkillSearchWaitService;
    }

    @PostMapping("/kb/token")
    public ApiResponse<KbSkillTokenResponse> createToken(@Valid @RequestBody KbSkillTokenCreateRequest request) {
        return ApiResponse.ok(kbSkillTokenAppService.createToken(
                request.getProjectId(),
                request.getKbId(),
                request.getDocRefs(),
                request.getAbilities(),
                request.getExpiresInDays(),
                request.getNeverExpires(),
                request.getExpiresInSeconds()
        ));
    }

    @PostMapping("/search")
    public DeferredResult<ApiResponse<KbSkillSearchResponse>> createSearch(@Valid @RequestBody KbSkillSearchRequest request) {
        Task task = kbSkillSearchAppService.createSearchTask(request.getToken(), request.getQuery());
        return kbSkillSearchWaitService.waitForResult(task);
    }
}
