// Responsibility: Expose stable SDK API for cycle and rolling usage querying.
package com.notebook.learyAI.module.usage.interfaces.sdk;

import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;

public interface UsageQuery {
    CurrentCycleUsage getCurrentCycleUsage(long userId, String projectId, String metric);

    RollingUsage getRollingUsage(long userId, String projectId, String metric, UsageWindowType windowType);
}
