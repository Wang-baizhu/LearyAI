// Responsibility: Verify usage event/cycle/reservation flows with real PostgreSQL and Redis.
package com.notebook.learyAI.module.usage.application;

import com.notebook.learyAI.module.usage.application.dto.CommitUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.CommitUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReleaseUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageRequestDTO;
import com.notebook.learyAI.module.usage.application.dto.ReserveUsageResponseDTO;
import com.notebook.learyAI.module.usage.application.service.UsageAppService;
import com.notebook.learyAI.module.usage.application.service.UsageCommitOutboxAppService;
import com.notebook.learyAI.module.usage.application.service.UsageControlAppService;
import com.notebook.learyAI.module.usage.domain.model.CurrentCycleUsage;
import com.notebook.learyAI.module.usage.domain.model.RollingUsage;
import com.notebook.learyAI.module.usage.domain.model.TurnLease;
import com.notebook.learyAI.module.usage.domain.model.UsageWindowType;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageCommitOutboxJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.SubscriptionCycleJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.jpa.UsageEventJpaRepository;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.UsageCommitOutboxPO;
import com.notebook.learyAI.module.usage.infrastructure.persistence.po.SubscriptionCyclePO;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Duration;
import java.time.Instant;
import java.sql.Timestamp;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class UsageAppServiceIntegrationTest extends AbstractPgRedisIntegrationTest {
    @Autowired
    private UsageAppService usageAppService;
    @Autowired
    private UsageControlAppService usageControlAppService;
    @Autowired
    private UsageCommitOutboxAppService usageCommitOutboxAppService;
    @Autowired
    private SubscriptionCycleJpaRepository subscriptionCycleJpaRepository;
    @Autowired
    private UsageEventJpaRepository usageEventJpaRepository;
    @Autowired
    private UsageCommitOutboxJpaRepository usageCommitOutboxJpaRepository;
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
        deleteRedisByPattern("usage:*");
        jdbcTemplate.update("delete from usage_commit_outbox");
        jdbcTemplate.update("delete from usage_event where idempotency_key like ?", "it-outbox-%");
        jdbcTemplate.update("delete from usage_commit_outbox where idempotency_key like ?", "it-outbox-%");
    }

    @AfterEach
    void tearDown() {
        deleteRedisByPattern("usage:*");
        jdbcTemplate.update("delete from usage_event where user_id = ?", userId);
        jdbcTemplate.update("delete from usage_commit_outbox");
        jdbcTemplate.update("delete from usage_event where idempotency_key like ?", "it-outbox-%");
        jdbcTemplate.update("delete from usage_commit_outbox where idempotency_key like ?", "it-outbox-%");
        jdbcTemplate.update("delete from subscription_cycle where user_id = ?", userId);
    }

    @Test
    @DisplayName("reserve -> commit -> current cycle: 应同步写入 event 与 Redis 当前周期状态")
    void reserveCommitAndQueryCurrentCycle_shouldKeepDbAndRedisConsistent() {
        createActiveCycle("ai_chat_tokens", "starter", 100L);

        ReserveUsageResponseDTO reserve = usageAppService.reserve(new ReserveUsageRequestDTO(
                userId,
                projectId,
                "ai_chat_tokens",
                "it-reserve-1",
                "request-1",
                30L,
                Duration.ofMinutes(5),
                Map.of("source", "test")
        ));

        assertTrue(reserve.success());
        assertTrue(reserve.reserved());
        assertEquals(30L, reserve.currentCycle().reserved());
        assertEquals(70L, reserve.currentCycle().available());

        CommitUsageResponseDTO commit = usageAppService.commit(new CommitUsageRequestDTO(
                userId,
                projectId,
                "ai_chat_tokens",
                "it-reserve-1",
                "request-1",
                30L,
                18L,
                "commit-1",
                "integration_test",
                "source-1",
                Map.of("kind", "happy-path"),
                now
        ));

        assertTrue(commit.success());
        assertTrue(commit.applied());
        assertNotNull(commit.event());
        assertEquals(18L, commit.currentCycle().used());
        assertEquals(0L, commit.currentCycle().reserved());
        assertEquals(82L, commit.currentCycle().available());
        assertEquals(1, usageEventJpaRepository.findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                userId,
                "ai_chat_tokens",
                now.minusSeconds(1),
                now.plusSeconds(1)
        ).size());

        CurrentCycleUsage current = usageAppService.getCurrentCycleUsage(userId, projectId, "ai_chat_tokens");
        assertEquals(18L, current.used());
        assertEquals(0L, current.reserved());
        assertEquals(82L, current.available());
    }

    @Test
    @DisplayName("空 projectId 全局 scope: single-call usage-control 应正常准入与结算")
    void usageControlSingleCall_withBlankProjectId_shouldUseGlobalScope() {
        createActiveCycle("ai_chat_tokens", "starter", 100L);

        var reserved = usageControlAppService.reserveSingleCall(
                userId,
                "",
                "ai_chat_tokens",
                "it-global-reserve-1",
                "it-global-request-1",
                10L,
                300L,
                Map.of("source", "tasks_server")
        );

        assertTrue(reserved.delegate().success());
        assertTrue(reserved.delegate().reserved());
        assertEquals("", reserved.currentPolicy().projectId());

        var committed = usageControlAppService.commitSingleCall(
                userId,
                "",
                "ai_chat_tokens",
                "it-global-reserve-1",
                "it-global-request-1",
                10L,
                6L,
                "it-global-commit-1",
                "tasks_server_llm_call",
                "call-1",
                Map.of("source", "tasks_server"),
                now.toString()
        );

        assertTrue(committed.delegate().success());
        assertTrue(committed.delegate().applied());
        assertEquals("", committed.currentPolicy().projectId());
        assertEquals(6L, committed.currentPolicy().used());

        CurrentCycleUsage current = usageAppService.getCurrentCycleUsage(userId, "", "ai_chat_tokens");
        assertEquals("", current.projectId());
        assertEquals(6L, current.used());
        assertEquals(94L, current.available());
    }

    @Test
    @DisplayName("reserve -> release: 应释放 reserved 且不写 usage_event")
    void reserveThenRelease_shouldClearReservedWithoutEvent() {
        createActiveCycle("ai_chat_tokens", "starter", 100L);
        usageAppService.reserve(new ReserveUsageRequestDTO(
                userId,
                projectId,
                "ai_chat_tokens",
                "it-reserve-2",
                "request-2",
                25L,
                Duration.ofMinutes(5),
                Map.of()
        ));

        ReleaseUsageResponseDTO release = usageAppService.release(new ReleaseUsageRequestDTO(
                userId,
                projectId,
                "ai_chat_tokens",
                "it-reserve-2",
                "request-2"
        ));

        assertTrue(release.success());
        assertTrue(release.released());
        assertEquals(0L, release.currentCycle().used());
        assertEquals(0L, release.currentCycle().reserved());
        assertEquals(100L, release.currentCycle().available());
        assertTrue(usageEventJpaRepository.findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                userId,
                "ai_chat_tokens",
                now.minusSeconds(60),
                now.plusSeconds(60)
        ).isEmpty());
    }

    @Test
    @DisplayName("commit 幂等重放: 不应重复写 event 或重复增加 used")
    void commitIdempotentReplay_shouldNotDoubleCharge() {
        createActiveCycle("ai_chat_tokens", "starter", 100L);
        usageAppService.reserve(new ReserveUsageRequestDTO(
                userId,
                projectId,
                "ai_chat_tokens",
                "it-reserve-3",
                "request-3",
                10L,
                Duration.ofMinutes(5),
                Map.of()
        ));

        CommitUsageRequestDTO request = new CommitUsageRequestDTO(
                userId,
                projectId,
                "ai_chat_tokens",
                "it-reserve-3",
                "request-3",
                10L,
                6L,
                "commit-3",
                "integration_test",
                "source-3",
                Map.of(),
                now
        );
        CommitUsageResponseDTO first = usageAppService.commit(request);
        CommitUsageResponseDTO replay = usageAppService.commit(request);

        assertTrue(first.applied());
        assertFalse(replay.applied());
        assertEquals(1, usageEventJpaRepository.findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                userId,
                "ai_chat_tokens",
                now.minusSeconds(1),
                now.plusSeconds(1)
        ).size());
        CurrentCycleUsage current = usageAppService.getCurrentCycleUsage(userId, projectId, "ai_chat_tokens");
        assertEquals(6L, current.used());
        assertEquals(94L, current.available());
    }

    @Test
    @DisplayName("rolling 查询缺 bucket 时应回退 DB 聚合")
    void getRollingUsage_withoutBuckets_shouldFallbackToDatabase() {
        createActiveCycle("ai_chat_tokens", "starter", 100L);
        usageAppService.commit(new CommitUsageRequestDTO(
                userId,
                projectId,
                "ai_chat_tokens",
                "reservation-rolling",
                "request-rolling",
                4L,
                4L,
                "commit-rolling",
                "integration_test",
                "source-rolling",
                Map.of(),
                now.minusSeconds(5)
        ));
        deleteRedisByPattern("usage:hour:*");
        deleteRedisByPattern("usage:day:*");

        RollingUsage rolling = usageAppService.getRollingUsage(userId, projectId, "ai_chat_tokens", UsageWindowType.LAST_24_HOURS);

        assertEquals(4L, rolling.used());
        assertEquals(UsageWindowType.LAST_24_HOURS, rolling.windowType());
    }

    @Test
    @DisplayName("current cycle: Redis 已缓存时仍应叠加 pending outbox delta")
    void getCurrentCycleUsage_shouldIncludePendingOutboxDeltaWhenRedisAlreadyCached() {
        createActiveCycle("kbdoc_size", "starter", 1024L);

        CurrentCycleUsage initial = usageAppService.getCurrentCycleUsage(userId, projectId, "kbdoc_size");
        assertEquals(0L, initial.used());

        savePendingOutbox("it-outbox-pending-current", "kbdoc_size", 256L, now);

        CurrentCycleUsage refreshed = usageAppService.getCurrentCycleUsage(userId, projectId, "kbdoc_size");
        assertEquals(256L, refreshed.used());
        assertEquals(768L, refreshed.available());
    }

    @Test
    @DisplayName("reserve: 应把 pending outbox delta 计入准入判断")
    void reserve_shouldDenyWhenPendingOutboxAlreadyConsumesQuota() {
        createActiveCycle("kbdoc_size", "starter", 100L);
        savePendingOutbox("it-outbox-pending-reserve", "kbdoc_size", 80L, now);

        BizException exception = assertThrows(BizException.class, () -> usageAppService.reserve(new ReserveUsageRequestDTO(
                userId,
                projectId,
                "kbdoc_size",
                "reserve-pending-1",
                "request-pending-1",
                30L,
                Duration.ofMinutes(5),
                Map.of()
        )));

        assertEquals("USAGE-403", exception.getCode());
        CurrentCycleUsage current = usageAppService.getCurrentCycleUsage(userId, projectId, "kbdoc_size");
        assertEquals(80L, current.used());
        assertEquals(20L, current.available());
    }

    @Test
    @DisplayName("会员 turn lease 成功闭环: 应完成 open -> commit call -> close")
    void memberTurnLeaseLifecycle_shouldPersistUsageAndCloseLease() {
        createActiveCycle("ai_chat_tokens", "pro", 100L);

        var opened = usageControlAppService.openTurnLease(
                userId,
                projectId,
                "ai_chat_tokens",
                "turn-1",
                "lease-1",
                "open-1",
                1800L,
                Map.of("source", "agent_ws")
        );

        assertTrue(opened.opened());
        assertEquals("OPEN", opened.lease().status());
        assertEquals("MEMBER", opened.currentPolicy().policyMode().name());

        var committed = usageControlAppService.commitTurnCallUsage(
                userId,
                projectId,
                "ai_chat_tokens",
                "lease-1",
                "turn-1",
                "call-1",
                12L,
                "call-commit-1",
                "agent_ws_llm_call",
                "call-1",
                Map.of("turnId", "turn-1"),
                now.toString()
        );

        assertTrue(committed.applied());
        assertEquals(12L, committed.currentPolicy().used());
        assertEquals(88L, committed.currentPolicy().available());

        var closed = usageControlAppService.closeTurnLease(userId, "lease-1", "turn-1", "close-1", "CLOSED");
        assertTrue(closed.changed());
        TurnLease lease = usageControlAppService.getTurnLease("lease-1");
        assertEquals("CLOSED", lease.status());

        CurrentCycleUsage current = usageAppService.getCurrentCycleUsage(userId, projectId, "ai_chat_tokens");
        assertEquals(12L, current.used());
        assertEquals(0L, current.reserved());
    }

    @Test
    @DisplayName("切换 active 周期后: 查询与后续扣减都应切到新周期")
    void activeCycleSwitch_shouldRebindRuntimeStateToCurrentActiveCycle() {
        SubscriptionCyclePO firstCycle = createCycle(
                "ai_chat_tokens",
                "pro",
                100L,
                now.minusSeconds(3600),
                now.plusSeconds(3600),
                "ACTIVE"
        );

        usageControlAppService.openTurnLease(
                userId,
                projectId,
                "ai_chat_tokens",
                "turn-switch-1",
                "lease-switch-1",
                "open-switch-1",
                1800L,
                Map.of()
        );
        usageControlAppService.commitTurnCallUsage(
                userId,
                projectId,
                "ai_chat_tokens",
                "lease-switch-1",
                "turn-switch-1",
                "call-switch-1",
                12L,
                "commit-switch-1",
                "agent_ws_llm_call",
                "call-switch-1",
                Map.of(),
                now.minusSeconds(120).toString()
        );

        CurrentCycleUsage beforeSwitch = usageAppService.getCurrentCycleUsage(userId, projectId, "ai_chat_tokens");
        assertEquals(firstCycle.getId(), beforeSwitch.cycleId());
        assertEquals(12L, beforeSwitch.used());

        jdbcTemplate.update(
                "update subscription_cycle set status = ?, updated_at = ? where id = ?",
                "INACTIVE",
                Timestamp.from(Instant.now()),
                firstCycle.getId()
        );
        SubscriptionCyclePO secondCycle = createCycle(
                "ai_chat_tokens",
                "plus",
                200L,
                now.minusSeconds(60),
                now.plusSeconds(7200),
                "ACTIVE"
        );

        CurrentCycleUsage switched = usageAppService.getCurrentCycleUsage(userId, projectId, "ai_chat_tokens");
        assertEquals(secondCycle.getId(), switched.cycleId());
        assertEquals(0L, switched.used());
        assertEquals(0L, switched.reserved());
        assertEquals(200L, switched.available());

        usageControlAppService.openTurnLease(
                userId,
                projectId,
                "ai_chat_tokens",
                "turn-switch-2",
                "lease-switch-2",
                "open-switch-2",
                1800L,
                Map.of()
        );
        usageControlAppService.commitTurnCallUsage(
                userId,
                projectId,
                "ai_chat_tokens",
                "lease-switch-2",
                "turn-switch-2",
                "call-switch-2",
                5L,
                "commit-switch-2",
                "agent_ws_llm_call",
                "call-switch-2",
                Map.of(),
                now.toString()
        );

        CurrentCycleUsage afterSwitchCommit = usageAppService.getCurrentCycleUsage(userId, projectId, "ai_chat_tokens");
        assertEquals(secondCycle.getId(), afterSwitchCommit.cycleId());
        assertEquals(5L, afterSwitchCommit.used());
        assertEquals(195L, afterSwitchCommit.available());
    }

    @Test
    @DisplayName("关闭后的 lease 不可再次 commit")
    void commitTurnCall_afterLeaseClosed_shouldThrowConflict() {
        createActiveCycle("ai_chat_tokens", "pro", 100L);
        usageControlAppService.openTurnLease(
                userId,
                projectId,
                "ai_chat_tokens",
                "turn-2",
                "lease-2",
                "open-2",
                1800L,
                Map.of()
        );
        usageControlAppService.closeTurnLease(userId, "lease-2", "turn-2", "close-2", "CLOSED");

        BizException exception = assertThrows(BizException.class, () -> usageControlAppService.commitTurnCallUsage(
                userId,
                projectId,
                "ai_chat_tokens",
                "lease-2",
                "turn-2",
                "call-2",
                8L,
                "call-commit-2",
                "agent_ws_llm_call",
                "call-2",
                Map.of(),
                now.toString()
        ));

        assertEquals("USAGE-409-LEASE", exception.getCode());
    }

    @Test
    @DisplayName("commit outbox: enqueue 后应立即投递并落 usage_event")
    void enqueueCommit_shouldDeliverImmediately() {
        createActiveCycle("kbdoc_size", "starter", 1024L);

        usageCommitOutboxAppService.enqueueCommit(new CommitUsageRequestDTO(
                userId,
                projectId,
                "kbdoc_size",
                "it-outbox-reserve-1",
                "it-outbox-request-1",
                256L,
                256L,
                "it-outbox-commit-1",
                "kbdoc_confirm_upload",
                "doc-1",
                Map.of("docId", "doc-1"),
                now
        ));
        usageCommitOutboxAppService.relayReadyBatch();

        UsageCommitOutboxPO outbox = usageCommitOutboxJpaRepository.findByIdempotencyKey("it-outbox-commit-1").orElseThrow();
        assertEquals("DELIVERED", outbox.getStatus());
        assertNotNull(outbox.getDeliveredAt());
        assertEquals(1, usageEventJpaRepository.findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                userId,
                "kbdoc_size",
                now.minusSeconds(1),
                now.plusSeconds(1)
        ).size());
    }

    @Test
    @DisplayName("commit outbox: 同 idempotencyKey 重复 enqueue 不应重复写 event")
    void enqueueCommit_duplicateIdempotency_shouldRemainSingleEvent() {
        createActiveCycle("kbdoc_size", "starter", 1024L);
        CommitUsageRequestDTO request = new CommitUsageRequestDTO(
                userId,
                projectId,
                "kbdoc_size",
                "it-outbox-reserve-2",
                "it-outbox-request-2",
                128L,
                128L,
                "it-outbox-commit-2",
                "kbdoc_confirm_upload",
                "doc-2",
                Map.of("docId", "doc-2"),
                now
        );

        usageCommitOutboxAppService.enqueueCommit(request);
        usageCommitOutboxAppService.enqueueCommit(request);
        usageCommitOutboxAppService.relayReadyBatch();

        Integer outboxCount = jdbcTemplate.queryForObject(
                "select count(*) from usage_commit_outbox where idempotency_key = ?",
                Integer.class,
                "it-outbox-commit-2"
        );
        assertEquals(1, outboxCount);
        assertEquals(1, usageEventJpaRepository.findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                userId,
                "kbdoc_size",
                now.minusSeconds(1),
                now.plusSeconds(1)
        ).size());
    }

    @Test
    @DisplayName("commit outbox: 首次投递失败后应保留 pending 并可重试成功")
    void enqueueCommit_whenImmediateDeliveryFails_shouldRetryLater() {
        usageCommitOutboxAppService.enqueueCommit(new CommitUsageRequestDTO(
                userId,
                projectId,
                "kbdoc_size",
                "it-outbox-reserve-3",
                "it-outbox-request-3",
                64L,
                64L,
                "it-outbox-commit-3",
                "kbdoc_confirm_upload",
                "doc-3",
                Map.of("docId", "doc-3"),
                now
        ));

        UsageCommitOutboxPO pending = usageCommitOutboxJpaRepository.findByIdempotencyKey("it-outbox-commit-3").orElseThrow();
        assertEquals("PENDING", pending.getStatus());
        assertEquals(0, pending.getRetryCount());
        assertTrue(usageEventJpaRepository.findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                userId,
                "kbdoc_size",
                now.minusSeconds(1),
                now.plusSeconds(1)
        ).isEmpty());

        createActiveCycle("kbdoc_size", "starter", 1024L);
        jdbcTemplate.update("update usage_commit_outbox set next_retry_at = ? where id = ?", Timestamp.from(Instant.now()), pending.getId());

        usageCommitOutboxAppService.relayReadyBatch();

        UsageCommitOutboxPO delivered = usageCommitOutboxJpaRepository.findById(pending.getId()).orElseThrow();
        assertEquals("DELIVERED", delivered.getStatus());
        assertNotNull(delivered.getDeliveredAt());
        assertEquals(1, usageEventJpaRepository.findByUserIdAndMetricAndOccurredAtGreaterThanEqualAndOccurredAtLessThan(
                userId,
                "kbdoc_size",
                now.minusSeconds(1),
                now.plusSeconds(1)
        ).size());
    }

    private void createActiveCycle(String metric, String planId, long quota) {
        createCycle(metric, planId, quota, now.minusSeconds(3600), now.plusSeconds(3600), "ACTIVE");
    }

    private SubscriptionCyclePO createCycle(String metric,
                                            String planId,
                                            long quota,
                                            Instant validFrom,
                                            Instant validTo,
                                            String status) {
        SubscriptionCyclePO po = new SubscriptionCyclePO();
        po.setUserId(userId);
        po.setMetric(metric);
        po.setPlanId(planId);
        po.setQuota(quota);
        po.setValidFrom(validFrom);
        po.setValidTo(validTo);
        po.setStatus(status);
        po.setCreatedAt(now);
        po.setUpdatedAt(now);
        return subscriptionCycleJpaRepository.save(po);
    }

    private void savePendingOutbox(String idempotencyKey, String metric, long actualAmount, Instant occurredAt) {
        UsageCommitOutboxPO po = new UsageCommitOutboxPO();
        po.setIdempotencyKey(idempotencyKey);
        po.setEventType("COMMIT_USAGE");
        po.setPayloadJson("""
                {"userId":%d,"projectId":"%s","metric":"%s","reservationId":"%s","requestId":"%s","requestedAmount":%d,"actualAmount":%d,"idempotencyKey":"%s","sourceType":"integration_test","sourceId":"%s","metadata":{},"occurredAt":"%s"}
                """.formatted(userId, projectId, metric, idempotencyKey, idempotencyKey, actualAmount, actualAmount, idempotencyKey, idempotencyKey, occurredAt.toString()).trim());
        po.setUserId(userId);
        po.setProjectId(projectId);
        po.setMetric(metric);
        po.setActualAmount(actualAmount);
        po.setOccurredAt(occurredAt);
        po.setStatus("PENDING");
        po.setRetryCount(0);
        po.setNextRetryAt(occurredAt.plusSeconds(3600));
        po.setCreatedAt(occurredAt);
        po.setUpdatedAt(occurredAt);
        usageCommitOutboxJpaRepository.save(po);
    }
}
