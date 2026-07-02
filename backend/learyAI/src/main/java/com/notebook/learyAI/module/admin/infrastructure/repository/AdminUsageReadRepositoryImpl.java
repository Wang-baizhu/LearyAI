// Responsibility: Implement admin usage read-only aggregation and event queries.
package com.notebook.learyAI.module.admin.infrastructure.repository;

import com.notebook.learyAI.module.admin.domain.repository.AdminUsageReadRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageEventPO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public class AdminUsageReadRepositoryImpl implements AdminUsageReadRepository {
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<UsageMetricAggregateRow> aggregateByMetric(Instant from,
                                                           Instant to,
                                                           Long userId,
                                                           String projectId) {
        String jpql = """
                select u.metric, coalesce(sum(u.delta), 0), -1
                from UsageEventPO u
                where u.occurredAt >= coalesce(:from, u.occurredAt)
                  and u.userId = coalesce(:userId, u.userId)
                  and u.projectId = coalesce(:projectId, u.projectId)
                """
                + (to == null ? "" : "\n  and u.occurredAt < :to")
                + "\ngroup by u.metric";
        var query = entityManager.createQuery(jpql, Object[].class)
                .setParameter("from", from)
                .setParameter("userId", userId)
                .setParameter("projectId", projectId);
        if (to != null) {
            query.setParameter("to", to);
        }
        return query.getResultList()
                .stream()
                .map(this::toAggregateRow)
                .toList();
    }

    @Override
    public UsageEventPageResult findEvents(Instant from,
                                           Instant to,
                                           String metric,
                                           Long userId,
                                           String projectId,
                                           int page,
                                           int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 100));
        long offset = (long) safePage * safeSize;

        String filterJpql = """
                from UsageEventPO u
                where u.occurredAt >= coalesce(:from, u.occurredAt)
                  and u.metric = coalesce(:metric, u.metric)
                  and u.userId = coalesce(:userId, u.userId)
                  and u.projectId = coalesce(:projectId, u.projectId)
                """
                + (to == null ? "" : "\n  and u.occurredAt < :to");
        var totalQuery = entityManager.createQuery("select count(u.id)\n" + filterJpql, Long.class)
                .setParameter("from", from)
                .setParameter("metric", metric)
                .setParameter("userId", userId)
                .setParameter("projectId", projectId);
        if (to != null) {
            totalQuery.setParameter("to", to);
        }
        Long total = totalQuery.getSingleResult();

        var itemsQuery = entityManager.createQuery(
                        "select u\n" + filterJpql + "\norder by u.occurredAt desc, u.id desc",
                        UsageEventPO.class
                )
                .setParameter("from", from)
                .setParameter("metric", metric)
                .setParameter("userId", userId)
                .setParameter("projectId", projectId)
                .setFirstResult((int) Math.min(offset, Integer.MAX_VALUE))
                .setMaxResults(safeSize);
        if (to != null) {
            itemsQuery.setParameter("to", to);
        }
        List<UsageEventRow> items = itemsQuery.getResultList()
                .stream()
                .map(this::toEventRow)
                .toList();

        return new UsageEventPageResult(total == null ? 0L : total, items);
    }

    private UsageMetricAggregateRow toAggregateRow(Object[] tuple) {
        String metric = tuple[0] == null ? null : String.valueOf(tuple[0]);
        Long used = tuple[1] instanceof Long ? (Long) tuple[1] : 0L;
        Long quota = tuple[2] instanceof Long ? (Long) tuple[2] : 0L;
        return new UsageMetricAggregateRow(metric, used, quota);
    }

    private UsageEventRow toEventRow(UsageEventPO po) {
        return new UsageEventRow(
                po.getUserId(),
                po.getProjectId(),
                po.getMetric(),
                po.getDelta(),
                po.getIdempotencyKey(),
                po.getSourceType(),
                po.getSourceId(),
                po.getOccurredAt(),
                po.getCreatedAt()
        );
    }
}
