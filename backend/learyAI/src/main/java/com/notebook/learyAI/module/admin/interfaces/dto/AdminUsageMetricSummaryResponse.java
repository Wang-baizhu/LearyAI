// Responsibility: Response payload for aggregated admin usage metric summary.
package com.notebook.learyAI.module.admin.interfaces.dto;

public class AdminUsageMetricSummaryResponse {
    private final String metric;
    private final long used;
    private final long reserved;
    private final long quota;
    private final long available;

    public AdminUsageMetricSummaryResponse(String metric, long used, long reserved, long quota, long available) {
        this.metric = metric;
        this.used = used;
        this.reserved = reserved;
        this.quota = quota;
        this.available = available;
    }

    public String getMetric() {
        return metric;
    }

    public long getUsed() {
        return used;
    }

    public long getReserved() {
        return reserved;
    }

    public long getQuota() {
        return quota;
    }

    public long getAvailable() {
        return available;
    }
}
