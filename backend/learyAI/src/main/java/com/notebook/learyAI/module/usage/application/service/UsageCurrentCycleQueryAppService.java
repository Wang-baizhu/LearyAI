// Responsibility: Provide current-cycle usage queries for self-service and internal admin callers.
package com.notebook.learyAI.module.usage.application.service;

import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageQuery;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

@Service
public class UsageCurrentCycleQueryAppService {
    private final UsageQuery usageQuery;

    public UsageCurrentCycleQueryAppService(UsageQuery usageQuery) {
        this.usageQuery = usageQuery;
    }

    public CurrentCycleUsage getCurrentUserCycle(String projectId, String metric) {
        Long userId = CurrentUserContext.getUserId();
        if (userId == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        return getUserCycle(userId, projectId, metric);
    }

    public CurrentCycleUsage getUserCycle(long userId, String projectId, String metric) {
        if (userId <= 0) {
            throw new BizException("USAGE-400", "userId invalid");
        }
        return usageQuery.getCurrentCycleUsage(userId, projectId, metric);
    }
}
