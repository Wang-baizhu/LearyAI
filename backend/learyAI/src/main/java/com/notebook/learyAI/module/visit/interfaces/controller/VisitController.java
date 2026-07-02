// Responsibility: Expose visit-related query endpoints.
package com.notebook.learyAI.module.visit.interfaces.controller;

import com.notebook.learyAI.module.skills.application.KbSkillSearchResponseAssembler;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillSearchResponse;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.visit.application.SkillTaskVisitQueryAppService;
import com.notebook.learyAI.module.visit.application.VisitQueryAppService;
import com.notebook.learyAI.module.visit.interfaces.dto.RecentVisitItemResponse;
import com.notebook.learyAI.module.visit.interfaces.dto.RecentVisitPageResponse;
import com.notebook.learyAI.shared.api.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping
public class VisitController {
    private final VisitQueryAppService visitQueryAppService;
    private final SkillTaskVisitQueryAppService skillTaskVisitQueryAppService;
    private final KbSkillSearchResponseAssembler kbSkillSearchResponseAssembler;

    public VisitController(VisitQueryAppService visitQueryAppService,
                           SkillTaskVisitQueryAppService skillTaskVisitQueryAppService,
                           KbSkillSearchResponseAssembler kbSkillSearchResponseAssembler) {
        this.visitQueryAppService = visitQueryAppService;
        this.skillTaskVisitQueryAppService = skillTaskVisitQueryAppService;
        this.kbSkillSearchResponseAssembler = kbSkillSearchResponseAssembler;
    }

    @GetMapping("/api/visits/recent")
    public ApiResponse<RecentVisitPageResponse> recent(@RequestParam(required = false) Integer size,
                                                       @RequestParam(required = false) String cursor) {
        VisitQueryAppService.RecentVisitPageView view = visitQueryAppService.listRecent(size, cursor);
        List<RecentVisitItemResponse> items = new ArrayList<>();
        for (VisitQueryAppService.RecentVisitItemView item : view.getItems()) {
            items.add(new RecentVisitItemResponse(
                    item.getResourceType(),
                    item.getResourceId(),
                    item.getVisitedAt(),
                    item.isAvailable(),
                    item.getTitle(),
                    item.getDescription(),
                    item.getProjectId(),
                    item.getKbId()
            ));
        }
        return ApiResponse.ok("最近内容查询成功", new RecentVisitPageResponse(items, view.isHasMore(), view.getNextCursor()));
    }

    @GetMapping("/api/skills/tasks")
    public ApiResponse<KbSkillSearchResponse> skillTaskDetail(@RequestParam String taskId,
                                                              @RequestParam String token) {
        Task task = skillTaskVisitQueryAppService.getTaskDetail(taskId, token);
        return ApiResponse.ok("任务详情查询成功", kbSkillSearchResponseAssembler.toResponse(task));
    }
}
