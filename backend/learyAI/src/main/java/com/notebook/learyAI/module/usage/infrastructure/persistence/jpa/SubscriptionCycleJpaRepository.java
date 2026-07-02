// Responsibility: Provide Spring Data access for subscription cycles.
package com.notebook.learyAI.module.usage.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.usage.infrastructure.persistence.po.SubscriptionCyclePO;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import jakarta.persistence.LockModeType;

public interface SubscriptionCycleJpaRepository extends JpaRepository<SubscriptionCyclePO, Long> {
    @Query("""
            select c
            from SubscriptionCyclePO c
            where c.userId = :userId
              and c.metric = :metric
              and c.status = 'ACTIVE'
              and c.validFrom <= :now
              and c.validTo > :now
            order by c.validFrom desc
            """)
    Optional<SubscriptionCyclePO> findActiveCycle(long userId, String metric, Instant now);

    List<SubscriptionCyclePO> findByUserIdOrderByValidFromDesc(long userId);

    List<SubscriptionCyclePO> findByUserIdAndMetricOrderByValidFromDesc(long userId, String metric);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select c
            from SubscriptionCyclePO c
            where c.userId = :userId
              and c.metric = :metric
              and c.status = 'ACTIVE'
            """)
    List<SubscriptionCyclePO> findActiveCyclesForUpdate(long userId, String metric);
}
