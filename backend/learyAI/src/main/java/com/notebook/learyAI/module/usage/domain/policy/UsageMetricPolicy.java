// Responsibility: Provide metric validation rules for usage operations.
package com.notebook.learyAI.module.usage.domain.policy;

import com.notebook.learyAI.shared.exception.BizException;

public class UsageMetricPolicy {
    public boolean isAllowed(String metric) {
        return metric != null && !metric.trim().isEmpty();
    }

    public void requireValid(String metric) {
        if (!isAllowed(metric)) {
            throw new BizException("USAGE-400", "metric required");
        }
    }
}
