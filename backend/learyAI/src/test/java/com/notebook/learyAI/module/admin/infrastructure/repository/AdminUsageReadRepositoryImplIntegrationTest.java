// Responsibility: Verify admin usage repository event ordering and aggregation with real PostgreSQL data.
package com.notebook.learyAI.module.admin.infrastructure.repository;

import com.notebook.learyAI.module.admin.domain.repository.AdminUsageReadRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageEventJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageEventPO;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AdminUsageReadRepositoryImplIntegrationTest extends AbstractPgRedisIntegrationTest {
    @Autowired
    private AdminUsageReadRepository adminUsageReadRepository;
    @Autowired
    private UsageEventJpaRepository usageEventJpaRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private long userId;
    private String projectId;
    private Instant now;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        userId = caseId;
        projectId = "project-" + caseId;
        now = Instant.now();
    }

    @AfterEach
    void tearDown() {
        jdbcTemplate.update("delete from usage_event where user_id = ?", userId);
    }

    @Test
    @DisplayName("findEvents: 应按 occurredAt desc, id desc 返回分页结果")
    void findEvents_shouldOrderByOccurredAtDescThenIdDesc() {
        saveEvent("event-1", 3L, now.minusSeconds(30), now.minusSeconds(30));
        saveEvent("event-2", 5L, now.minusSeconds(10), now.minusSeconds(10));
        saveEvent("event-3", 7L, now.minusSeconds(10), now.minusSeconds(5));

        AdminUsageReadRepository.UsageEventPageResult result = adminUsageReadRepository.findEvents(
                now.minusSeconds(60),
                now.plusSeconds(60),
                "ai_chat_tokens",
                userId,
                projectId,
                0,
                10
        );

        assertEquals(3L, result.total());
        assertEquals(List.of("event-3", "event-2", "event-1"),
                result.items().stream().map(AdminUsageReadRepository.UsageEventRow::sourceId).toList());
    }

    @Test
    @DisplayName("aggregateByMetric: 应按过滤条件聚合 delta")
    void aggregateByMetric_shouldFilterAndSumDelta() {
        saveEvent("chat-1", 4L, now.minusSeconds(20), now.minusSeconds(20));
        saveEvent("chat-2", 6L, now.minusSeconds(10), now.minusSeconds(10));
        saveEvent("kb-1", 9L, "kbdoc_size", now.minusSeconds(5), now.minusSeconds(5));
        saveEvent("other-project", 100L, "ai_chat_tokens", "project-other", now.minusSeconds(5), now.minusSeconds(5));

        List<AdminUsageReadRepository.UsageMetricAggregateRow> rows = adminUsageReadRepository.aggregateByMetric(
                now.minusSeconds(60),
                now.plusSeconds(60),
                userId,
                projectId
        );

        assertEquals(2, rows.size());
        assertEquals(10L, rows.stream().filter(it -> it.metric().equals("ai_chat_tokens")).findFirst().orElseThrow().used());
        assertEquals(9L, rows.stream().filter(it -> it.metric().equals("kbdoc_size")).findFirst().orElseThrow().used());
    }

    @Test
    @DisplayName("aggregateByMetric: 仅传 from 且 to 为空时仍应返回命中数据")
    void aggregateByMetric_withNullToShouldStillMatchOpenRange() {
        saveEvent("chat-open-range", 4L, now.minusSeconds(20), now.minusSeconds(20));

        List<AdminUsageReadRepository.UsageMetricAggregateRow> rows = adminUsageReadRepository.aggregateByMetric(
                now.minusSeconds(60),
                null,
                userId,
                projectId
        );

        assertEquals(1, rows.size());
        assertEquals(4L, rows.get(0).used());
    }

    private void saveEvent(String sourceId, long delta, Instant occurredAt, Instant createdAt) {
        saveEvent(sourceId, delta, "ai_chat_tokens", projectId, occurredAt, createdAt);
    }

    private void saveEvent(String sourceId, long delta, String metric, Instant occurredAt, Instant createdAt) {
        saveEvent(sourceId, delta, metric, projectId, occurredAt, createdAt);
    }

    private void saveEvent(String sourceId, long delta, String metric, String targetProjectId, Instant occurredAt, Instant createdAt) {
        UsageEventPO po = new UsageEventPO();
        po.setUserId(userId);
        po.setProjectId(targetProjectId);
        po.setMetric(metric);
        po.setDelta(delta);
        po.setOccurredAt(occurredAt);
        po.setIdempotencyKey("idem-" + sourceId);
        po.setSourceType("integration_test");
        po.setSourceId(sourceId);
        po.setMetadataJson("{}");
        po.setCreatedAt(createdAt);
        usageEventJpaRepository.save(po);
    }
}
