// Responsibility: Manage subscription cycle records for admin-operated quota configuration.
package com.notebook.learyAI.module.usage.application.service;

import com.notebook.learyAI.module.usage.application.dto.UpsertSubscriptionCycleRequestDTO;
import com.notebook.learyAI.module.usage.domain.model.SubscriptionCycle;
import com.notebook.learyAI.module.usage.domain.policy.UsageMetricPolicy;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.SubscriptionCycleJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.SubscriptionCyclePO;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;

@Service
public class SubscriptionCycleAdminAppService {
    private final SubscriptionCycleJpaRepository subscriptionCycleJpaRepository;
    private final UsageMetricPolicy usageMetricPolicy = new UsageMetricPolicy();

    public SubscriptionCycleAdminAppService(SubscriptionCycleJpaRepository subscriptionCycleJpaRepository) {
        this.subscriptionCycleJpaRepository = subscriptionCycleJpaRepository;
    }

    public List<SubscriptionCycle> listUserCycles(long userId, String metric) {
        if (userId <= 0) {
            throw new BizException("USAGE-400", "userId invalid");
        }
        List<SubscriptionCyclePO> items;
        if (metric == null || metric.isBlank()) {
            items = subscriptionCycleJpaRepository.findByUserIdOrderByValidFromDesc(userId);
        } else {
            usageMetricPolicy.requireValid(metric.trim());
            items = subscriptionCycleJpaRepository.findByUserIdAndMetricOrderByValidFromDesc(userId, metric.trim());
        }
        return items.stream().map(this::toDomain).toList();
    }

    @Transactional
    public SubscriptionCycle upsertCycle(UpsertSubscriptionCycleRequestDTO request) {
        validate(request);
        Instant now = Instant.now();
        String metric = request.metric().trim();
        String planId = request.planId().trim();
        List<SubscriptionCyclePO> activeCycles = subscriptionCycleJpaRepository.findActiveCyclesForUpdate(request.userId(), metric);
        for (SubscriptionCyclePO active : activeCycles) {
            active.setStatus("INACTIVE");
            active.setUpdatedAt(now);
        }
        subscriptionCycleJpaRepository.saveAll(activeCycles);

        SubscriptionCyclePO po = new SubscriptionCyclePO();
        po.setUserId(request.userId());
        po.setMetric(metric);
        po.setPlanId(planId);
        po.setQuota(request.quota());
        po.setValidFrom(request.validFrom());
        po.setValidTo(request.validTo());
        po.setStatus("ACTIVE");
        po.setCreatedAt(now);
        po.setUpdatedAt(now);
        return toDomain(subscriptionCycleJpaRepository.save(po));
    }

    private void validate(UpsertSubscriptionCycleRequestDTO request) {
        if (request == null) {
            throw new BizException("USAGE-400", "request required");
        }
        if (request.userId() <= 0) {
            throw new BizException("USAGE-400", "userId invalid");
        }
        usageMetricPolicy.requireValid(request.metric());
        if (request.planId() == null || request.planId().isBlank()) {
            throw new BizException("USAGE-400", "planId required");
        }
        if (request.quota() < 0) {
            throw new BizException("USAGE-400", "quota invalid");
        }
        if (request.validFrom() == null || request.validTo() == null) {
            throw new BizException("USAGE-400", "valid period required");
        }
        if (!request.validFrom().isBefore(request.validTo())) {
            throw new BizException("USAGE-400", "valid period invalid");
        }
    }

    private SubscriptionCycle toDomain(SubscriptionCyclePO po) {
        return new SubscriptionCycle(
                po.getId(),
                po.getUserId(),
                po.getMetric(),
                po.getPlanId(),
                po.getQuota(),
                po.getValidFrom(),
                po.getValidTo(),
                po.getStatus(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }
}
