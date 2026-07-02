// Responsibility: Verify knowledge base cache hit/evict/reload flow with real PostgreSQL and Redis.
package com.notebook.learyAI.module.kb.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.kb.application.cache.KnowledgeBaseQueryCache;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kb.domain.service.KnowledgeBaseDomainService;
import com.notebook.learyAI.module.kb.infrastructure.cache.KnowledgeBaseCacheProperties;
import com.notebook.learyAI.module.kb.infrastructure.cache.RedisKnowledgeBaseQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.visit.application.UserResourceVisitAppService;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import com.notebook.learyAI.shared.cache.CacheCommonProperties;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class KnowledgeBaseCacheIntegrationFlowTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private KnowledgeBaseRepository repository;
    @Autowired
    private UserResourceVisitAppService visitAppService;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private TransactionTemplate transactionTemplate;

    private RedisCacheSupport redisCacheSupport;
    private KnowledgeBaseAppService knowledgeBaseAppService;
    private String testProjectId;
    private String testKbId;
    private long testUserId;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);
        testKbId = UUID.randomUUID().toString();
        testUserId = caseId;

        CacheCommonProperties commonProperties = new CacheCommonProperties();
        commonProperties.setEnabled(true);
        commonProperties.setJitterPercent(0);
        commonProperties.setSecondDeleteEnabled(false);
        redisCacheSupport = new RedisCacheSupport(stringRedisTemplate, commonProperties);
        knowledgeBaseAppService = buildKnowledgeBaseAppService(600);

        repository.save(new KnowledgeBase(
                null,
                testKbId,
                testProjectId,
                "kb-old",
                "desc",
                List.of("t1"),
                testUserId,
                KnowledgeBaseVisibility.PRIVATE,
                Instant.now()
        ));
    }

    @AfterEach
    void tearDown() {
        deleteRedisByPattern("kb:list:" + testProjectId + ":*");
        deleteRedisByPattern("kb:recent:" + testProjectId + ":*");
        deleteRedisByPattern("kb:detail:" + testProjectId + ":*");
        if (redisCacheSupport != null) {
            redisCacheSupport.destroy();
        }
        jdbcTemplate.update("delete from user_resource_visit where user_id = ?", testUserId);
        jdbcTemplate.update("delete from knowledge_base where project_id = cast(? as uuid)", testProjectId);
    }

    @Test
    @DisplayName("固定projectId/kbId/userId：list/detail/recent 二次读取命中缓存，update 后失效并回源")
    void listDetailRecent_shouldHitCache_thenEvictAfterUpdate() {
        // First round: warm up list/detail/recent caches from DB.
        KnowledgeBasePage list1 = knowledgeBaseAppService.list(testProjectId, null, null, "name", null, 1, 20);
        KnowledgeBase detail1 = knowledgeBaseAppService.getByKbId(testProjectId, testKbId);
        List<KnowledgeBase> recent1 = knowledgeBaseAppService.listRecent(testProjectId, 10);
        assertEquals("kb-old", list1.getItems().get(0).getName());
        assertEquals("kb-old", detail1.getName());
        assertEquals("kb-old", recent1.get(0).getName());

        // Change PG directly without going through app service, so cache is not evicted.
        jdbcTemplate.update("update knowledge_base set name = ? where kb_id = cast(? as uuid)", "kb-db-changed", testKbId);

        KnowledgeBasePage list2 = knowledgeBaseAppService.list(testProjectId, null, null, "name", null, 1, 20);
        // Read recent before detail because getByKbId() internally evicts recent cache.
        List<KnowledgeBase> recent2 = knowledgeBaseAppService.listRecent(testProjectId, 10);
        KnowledgeBase detail2 = knowledgeBaseAppService.getByKbId(testProjectId, testKbId);

        // If cache is hit, second read still returns old value instead of DB-changed value.
        assertEquals("kb-old", list2.getItems().get(0).getName());
        assertEquals("kb-old", detail2.getName());
        assertEquals("kb-old", recent2.get(0).getName());

        transactionTemplate.executeWithoutResult(status ->
                knowledgeBaseAppService.update(testProjectId, testKbId, "kb-new", null, null, null, null));

        KnowledgeBasePage listAfter = knowledgeBaseAppService.list(testProjectId, null, null, "name", null, 1, 20);
        KnowledgeBase detailAfter = knowledgeBaseAppService.getByKbId(testProjectId, testKbId);
        List<KnowledgeBase> recentAfter = knowledgeBaseAppService.listRecent(testProjectId, 10);

        assertEquals("kb-new", listAfter.getItems().get(0).getName());
        assertEquals("kb-new", detailAfter.getName());
        assertEquals("kb-new", recentAfter.get(0).getName());
    }

    @Test
    @DisplayName("固定projectId/kbId/userId：recordVisit 后 recent 缓存失效并回源")
    void recent_shouldEvictAfterRecordVisit() {
        Instant first = Instant.now();
        Instant second = first.plusSeconds(60);

        transactionTemplate.executeWithoutResult(status ->
                knowledgeBaseAppService.recordVisit(testProjectId, testKbId, first));
        List<KnowledgeBase> recent1 = knowledgeBaseAppService.listRecent(testProjectId, 10);
        List<KnowledgeBase> recent2 = knowledgeBaseAppService.listRecent(testProjectId, 10);
        assertEquals(first.toEpochMilli(), recent1.get(0).getVisitedAt().toEpochMilli());
        assertEquals(first.toEpochMilli(), recent2.get(0).getVisitedAt().toEpochMilli());

        transactionTemplate.executeWithoutResult(status ->
                knowledgeBaseAppService.recordVisit(testProjectId, testKbId, second));
        List<KnowledgeBase> recentAfter = knowledgeBaseAppService.listRecent(testProjectId, 10);

        assertEquals(second.toEpochMilli(), recentAfter.get(0).getVisitedAt().toEpochMilli());
    }

    @Test
    @DisplayName("固定projectId/kbId/userId：detail 缓存 TTL 到期后应自动回源最新值")
    void detail_shouldAutoReloadAfterTtlExpires() {
        KnowledgeBaseAppService shortTtlService = buildKnowledgeBaseAppService(1);

        KnowledgeBase first = shortTtlService.getByKbId(testProjectId, testKbId);
        assertEquals("kb-old", first.getName());

        jdbcTemplate.update("update knowledge_base set name = ? where kb_id = cast(? as uuid)", "kb-ttl-new", testKbId);
        sleepMillis(1200);

        KnowledgeBase second = shortTtlService.getByKbId(testProjectId, testKbId);
        assertEquals("kb-ttl-new", second.getName());
    }

    private KnowledgeBaseAppService buildKnowledgeBaseAppService(int ttlSeconds) {
        KnowledgeBaseCacheProperties kbCacheProperties = new KnowledgeBaseCacheProperties();
        kbCacheProperties.setListTtlSeconds(ttlSeconds);
        kbCacheProperties.setDetailTtlSeconds(ttlSeconds);
        kbCacheProperties.setRecentTtlSeconds(ttlSeconds);
        KnowledgeBaseQueryCache cache = new RedisKnowledgeBaseQueryCache(
                redisCacheSupport,
                stringRedisTemplate,
                new ObjectMapper(),
                kbCacheProperties
        );

        KbDocRelationRepository relationRepository = mock(KbDocRelationRepository.class);
        KbDocRepository docRepository = mock(KbDocRepository.class);
        KnowledgeBaseAccessSupport accessSupport = mock(KnowledgeBaseAccessSupport.class);
        AuthzSdk authzSdk = mock(AuthzSdk.class);
        KnowledgeBaseDomainService domainService = new KnowledgeBaseDomainService();

        doNothing().when(accessSupport).ensureAccess(any(KnowledgeBase.class), eq(testUserId));
        when(authzSdk.requireUserId()).thenReturn(testUserId);
        when(authzSdk.requireProjectId(testProjectId, "KB-400", "KB-400", "KB-404"))
                .thenReturn(testProjectId);
        when(authzSdk.isMember(testUserId, testProjectId)).thenReturn(true);

        return new KnowledgeBaseAppService(
                repository,
                relationRepository,
                docRepository,
                visitAppService,
                accessSupport,
                domainService,
                authzSdk,
                cache
        );
    }

    private void sleepMillis(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw new AssertionError("sleep interrupted", ex);
        }
    }
}
