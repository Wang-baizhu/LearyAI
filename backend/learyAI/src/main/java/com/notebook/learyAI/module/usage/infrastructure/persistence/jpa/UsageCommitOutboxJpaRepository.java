// Responsibility: Provide Spring Data access for deferred usage commit outbox records.
package com.notebook.learyAI.module.usage.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageCommitOutboxPO;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface UsageCommitOutboxJpaRepository extends JpaRepository<UsageCommitOutboxPO, Long> {
    Optional<UsageCommitOutboxPO> findByIdempotencyKey(String idempotencyKey);

    List<UsageCommitOutboxPO> findByStatusAndNextRetryAtLessThanEqualOrderByIdAsc(
            String status,
            Instant nextRetryAt,
            Pageable pageable
    );

    @Query("""
            select coalesce(sum(o.actualAmount), 0)
            from UsageCommitOutboxPO o
            where o.status = :status
              and o.userId = :userId
              and o.projectId = :projectId
              and o.metric = :metric
              and o.occurredAt >= :from
              and o.occurredAt < :to
            """)
    Long sumActualAmountByStatusAndUserProjectMetricBetween(String status,
                                                            long userId,
                                                            String projectId,
                                                            String metric,
                                                            Instant from,
                                                            Instant to);
}
