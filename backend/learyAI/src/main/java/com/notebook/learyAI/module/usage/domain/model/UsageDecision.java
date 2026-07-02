// Responsibility: Carry normalized usage check/consume decision details.
package com.notebook.learyAI.module.usage.domain.model;

public record UsageDecision(
        boolean allowed,
        String denyCode,
        String denyMessage,
        long used,
        long quota,
        String metric
) {
    public static UsageDecision allow(String metric, long used, long quota) {
        return new UsageDecision(true, null, null, used, quota, metric);
    }

    public static UsageDecision deny(String denyCode, String denyMessage, String metric, long used, long quota) {
        return new UsageDecision(false, denyCode, denyMessage, used, quota, metric);
    }
}
