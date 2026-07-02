// Responsibility: Provide Spring Data access for usage events.
package com.notebook.learyAI.module.usage.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageEventPO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UsageEventJpaRepository extends JpaRepository<UsageEventPO, Long> {
    Optional<UsageEventPO> findByIdempotencyKey(String idempotencyKey);

    @Query("""
            select coalesce(sum(u.delta), 0)
            from UsageEventPO u
            where u.userId = :userId
              and u.metric = :metric
              and u.occurredAt >= :from
              and u.occurredAt < :to
            """)
    Long sumDeltaByUserMetricBetween(long userId, String metric, Instant from, Instant to);

    @Query("""
            select coalesce(sum(u.delta), 0)
            from UsageEventPO u
            where u.userId = :userId
              and u.projectId = :projectId
              and u.metric = :metric
              and u.occurredAt >= :from
              and u.occurredAt < :to
            """)
    Long sumDeltaByUserProjectMetricBetween(long userId, String projectId, String metric, Instant from, Instant to);

    List<UsageEventPO> findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
            long userId, String metric, Instant from, Instant to);
}
