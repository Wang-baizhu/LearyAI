// Responsibility: Implement UsageQuery by delegating to usage application service.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.service.UsageAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageQuery;
import org.springframework.stereotype.Service;

@Service
public class UsageQueryImpl implements UsageQuery {
    private final UsageAppService usageAppService;

    public UsageQueryImpl(UsageAppService usageAppService) {
        this.usageAppService = usageAppService;
    }

    @Override
    public CurrentCycleUsage getCurrentCycleUsage(long userId, String projectId, String metric) {
        return usageAppService.getCurrentCycleUsage(userId, projectId, metric);
    }

    @Override
    public RollingUsage getRollingUsage(long userId, String projectId, String metric, UsageWindowType windowType) {
        return usageAppService.getRollingUsage(userId, projectId, metric, windowType);
    }
}
