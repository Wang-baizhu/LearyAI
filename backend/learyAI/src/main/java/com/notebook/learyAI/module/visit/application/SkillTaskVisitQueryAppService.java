// Responsibility: Query visible skill tasks by persisted skill-token scope.
package com.notebook.learyAI.module.visit.application;

import com.notebook.learyAI.module.skills.application.KbSkillTokenResolverAppService;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

@Service
public class SkillTaskVisitQueryAppService {
    private final KbSkillTokenResolverAppService kbSkillTokenResolverAppService;
    private final TaskAppService taskAppService;

    public SkillTaskVisitQueryAppService(KbSkillTokenResolverAppService kbSkillTokenResolverAppService,
                                         TaskAppService taskAppService) {
        this.kbSkillTokenResolverAppService = kbSkillTokenResolverAppService;
        this.taskAppService = taskAppService;
    }

    public Task getTaskDetail(String taskId, String token) {
        if (taskId == null || taskId.isBlank()) {
            throw new BizException("KB-400", "taskId required");
        }
        KbSkillTokenRecord tokenRecord = kbSkillTokenResolverAppService.resolveActiveToken(token);
        KbSkillTokenPayload payload = tokenRecord.getPayload();
        return taskAppService.findVisibleSearchPipelineByPublicTaskIdAndScope(taskId.trim(), tokenRecord.getUserId(),
                        payload.getProjectId().trim(), payload.getKbId().trim())
                .orElseThrow(() -> new BizException("KB-404", "task not found"));
    }
}
