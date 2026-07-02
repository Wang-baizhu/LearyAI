// Responsibility: Define admin read-only usage aggregation and event pagination queries.
package com.notebook.learyAI.module.admin.domain.repository;

import java.time.Instant;
import java.util.List;

public interface AdminUsageReadRepository {
    List<UsageMetricAggregateRow> aggregateByMetric(Instant from,
                                                    Instant to,
                                                    Long userId,
                                                    String projectId);

    UsageEventPageResult findEvents(Instant from,
                                    Instant to,
                                    String metric,
                                    Long userId,
                                    String projectId,
                                    int page,
                                    int size);

    record UsageMetricAggregateRow(String metric, Long used, Long quota) {
    }

    record UsageEventRow(long userId,
                         String projectId,
                         String metric,
                         long delta,
                         String idempotencyKey,
                         String sourceType,
                         String sourceId,
                         Instant occurredAt,
                         Instant createdAt) {
    }

    record UsageEventPageResult(long total, List<UsageEventRow> items) {
    }
}
