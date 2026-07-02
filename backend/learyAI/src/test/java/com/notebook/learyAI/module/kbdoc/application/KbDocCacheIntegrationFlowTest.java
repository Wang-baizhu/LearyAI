// Responsibility: Verify kb-doc cache hit/evict/reload flow with real PostgreSQL and Redis.
package com.notebook.learyAI.module.kbdoc.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.kb.application.KnowledgeBaseAppService;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.kbdoc.infrastructure.cache.KbDocCacheProperties;
import com.notebook.learyAI.module.kbdoc.infrastructure.cache.RedisKbDocQueryCache;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import com.notebook.learyAI.shared.cache.CacheCommonProperties;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Assumptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class KbDocCacheIntegrationFlowTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private KbDocRepository docRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private RedisCacheSupport redisCacheSupport;
    private KbDocQueryAppService queryAppService;
    private KbDocTaskStatusListener taskStatusListener;
    private KbDocAppSupport support;
    private TaskAppService taskAppService;
    private String testProjectId;
    private long testUserId;
    private String testDocId;
    private boolean chunkTablesAvailable;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);
        testUserId = caseId;
        testDocId = "doc-cache-" + caseId;
        chunkTablesAvailable = tableExists(jdbcTemplate, "kb_chunk_zh") && tableExists(jdbcTemplate, "kb_chunk_en");

        CacheCommonProperties commonProperties = new CacheCommonProperties();
        commonProperties.setEnabled(true);
        commonProperties.setJitterPercent(0);
        commonProperties.setSecondDeleteEnabled(false);
        redisCacheSupport = new RedisCacheSupport(stringRedisTemplate, commonProperties);
        support = mock(KbDocAppSupport.class);
        taskAppService = mock(TaskAppService.class);
        KbDocQueryCache cache = buildKbDocQueryCache(600);
        queryAppService = new KbDocQueryAppService(docRepository, mock(KnowledgeBaseAppService.class), support, cache);
        taskStatusListener = new KbDocTaskStatusListener(docRepository, cache, taskAppService);

        when(support.requireUserId()).thenReturn(testUserId);
        when(support.requireProjectId(testProjectId)).thenReturn(testProjectId);
        when(support.normalizeRequired(anyString(), anyString()))
                .thenAnswer(invocation -> invocation.getArgument(0));
        when(support.normalizeOptional(anyString()))
                .thenAnswer(invocation -> {
                    String raw = invocation.getArgument(0);
                    return raw == null ? null : raw.trim();
                });
        doNothing().when(support).requireMember(testProjectId, testUserId);
    }

    @AfterEach
    void tearDown() {
        deleteRedisByPattern("kbdoc:list:" + testProjectId + ":*");
        deleteRedisByPattern("kbdoc:detail:" + testProjectId + ":*");
        deleteRedisByPattern("kbdoc:chunks:" + testProjectId + ":*");
        deleteRedisByPattern("kbdoc:recent:" + testProjectId + ":*");
        deleteRedisByPattern("kbdoc:options:" + testProjectId + ":*");
        if (redisCacheSupport != null) {
            redisCacheSupport.destroy();
        }
        if (chunkTablesAvailable) {
            jdbcTemplate.update("delete from kb_chunk_zh where doc_id in (select id from kb_doc where project_id = cast(? as uuid))",
                    testProjectId);
            jdbcTemplate.update("delete from kb_chunk_en where doc_id in (select id from kb_doc where project_id = cast(? as uuid))",
                    testProjectId);
        }
        jdbcTemplate.update("delete from kb_doc_rel where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from kb_doc where project_id = cast(? as uuid)", testProjectId);
    }

    @Test
    @DisplayName("固定projectId/docId/userId：list/detail/chunks/recent 命中缓存")
    void query_shouldHitCache() {
        Assumptions.assumeTrue(chunkTablesAvailable, "kb_chunk tables are unavailable");
        Instant now = Instant.now();
        KbDoc v1 = docRepository.save(new KbDoc(
                null, testProjectId, testDocId, "doc-v1", "txt", 128L,
                "obj-1", "minio", "url-1", null, "PROCESSING", now, now
        ));
        jdbcTemplate.update("insert into kb_chunk_zh(doc_id, page_num, text) values (?, ?, ?)", v1.getId(), 1, "v1-a");
        jdbcTemplate.update("insert into kb_chunk_zh(doc_id, page_num, text) values (?, ?, ?)", v1.getId(), 2, "v1-b");
        when(support.requireDocByDocId(testDocId)).thenReturn(v1);
        doNothing().when(support).ensureDocAccess(v1, testUserId);

        KbDocPage listRead1 = queryAppService.list(testProjectId, null, null, 1, 20, null);
        KbDocPage listRead2 = queryAppService.list(testProjectId, null, null, 1, 20, null);
        KbDoc detailRead1 = queryAppService.getByDocId(testProjectId, testDocId);
        KbDoc detailRead2 = queryAppService.getByDocId(testProjectId, testDocId);
        KbDocTextChunkPage chunksRead1 = queryAppService.listTextChunks(testProjectId, testDocId, 1, 2);
        KbDocTextChunkPage chunksRead2 = queryAppService.listTextChunks(testProjectId, testDocId, 1, 2);
        List<String> recentRead1 = queryAppService.listRecentIds(testProjectId, 10);
        List<String> recentRead2 = queryAppService.listRecentIds(testProjectId, 10);

        assertEquals("doc-v1", listRead1.getItems().get(0).getName());
        assertEquals("doc-v1", listRead2.getItems().get(0).getName());
        assertEquals("doc-v1", detailRead1.getName());
        assertEquals("doc-v1", detailRead2.getName());
        assertEquals("v1-a", chunksRead1.getItems().get(0).getText());
        assertEquals("v1-a", chunksRead2.getItems().get(0).getText());
        assertEquals(testDocId, recentRead1.get(0));
        assertEquals(testDocId, recentRead2.get(0));

        jdbcTemplate.update("update kb_doc set name = ? where id = ?", "doc-db-new", v1.getId());
        jdbcTemplate.update("update kb_chunk_zh set text = ? where doc_id = ? and page_num = 1", "v1-db-a", v1.getId());

        KbDoc listCached = queryAppService.list(testProjectId, null, null, 1, 20, null).getItems().get(0);
        KbDoc detailCached = queryAppService.getByDocId(testProjectId, testDocId);
        KbDocTextChunkPage chunksCached = queryAppService.listTextChunks(testProjectId, testDocId, 1, 2);
        assertEquals("doc-v1", listCached.getName());
        assertEquals("doc-v1", detailCached.getName());
        assertEquals("v1-a", chunksCached.getItems().get(0).getText());
    }

    @Test
    @DisplayName("固定projectId/docId/userId：任务状态变更后 detail 缓存失效并回源新状态")
    void detail_shouldEvictAfterTaskStatusChanged() {
        Instant now = Instant.now();
        docRepository.save(new KbDoc(
                null, testProjectId, testDocId, "doc", "txt", 128L,
                "obj-1", "minio", "url-1", null, "PROCESSING", now, now
        ));

        KbDoc read1 = queryAppService.getByDocId(testProjectId, testDocId);
        KbDoc read2 = queryAppService.getByDocId(testProjectId, testDocId);
        assertEquals("PROCESSING", read1.getStatus());
        assertEquals("PROCESSING", read2.getStatus());

        Task changedTask = new Task(100L, "task-100", testProjectId, null, testUserId,
                "document_pipeline", TaskStatus.DONE, null, "{}", null, testDocId, now, now.plusSeconds(60));
        taskStatusListener.onStatusChanged(changedTask, TaskStatus.PROCESSING, "status_change");

        KbDoc readAfter = queryAppService.getByDocId(testProjectId, testDocId);
        assertEquals("DONE", readAfter.getStatus());
    }

    @Test
    @DisplayName("固定projectId/docId/userId：options 二次读取命中缓存，任务状态变更后失效并回源")
    void options_shouldHitCache_thenEvictAfterTaskStatusChanged() {
        Instant now = Instant.now();
        KbDoc saved = docRepository.save(new KbDoc(
                null, testProjectId, testDocId, "old-name", "txt", 128L,
                "obj-1", "minio", "url-1", null, "PROCESSING", now, now
        ));

        List<KbDocOption> options1 = queryAppService.listDocOptions(testProjectId, "doc", null);
        List<KbDocOption> options2 = queryAppService.listDocOptions(testProjectId, "doc", null);
        assertEquals("old-name", options1.get(0).getName());
        assertEquals("old-name", options2.get(0).getName());

        jdbcTemplate.update("update kb_doc set name = ? where id = ?", "new-name", saved.getId());
        Task changedTask = new Task(101L, "task-101", testProjectId, null, testUserId,
                "document_pipeline", TaskStatus.DONE, null, "{}", null, testDocId, now, now.plusSeconds(10));
        taskStatusListener.onStatusChanged(changedTask, TaskStatus.PROCESSING, "status_change");

        List<KbDocOption> optionsAfter = queryAppService.listDocOptions(testProjectId, "doc", null);
        assertEquals("new-name", optionsAfter.get(0).getName());
        assertEquals("DONE", optionsAfter.get(0).getStatus());
    }

    @Test
    @DisplayName("固定projectId/docId/userId：list 缓存 TTL 到期后应自动回源最新值")
    void list_shouldAutoReloadAfterTtlExpires() {
        KbDocQueryCache shortTtlCache = buildKbDocQueryCache(1);
        KbDocQueryAppService shortTtlService = new KbDocQueryAppService(
                docRepository, mock(KnowledgeBaseAppService.class), support, shortTtlCache
        );

        Instant now = Instant.now();
        KbDoc saved = docRepository.save(new KbDoc(
                null, testProjectId, testDocId, "ttl-old", "txt", 128L,
                "obj-1", "minio", "url-1", null, "PROCESSING", now, now
        ));

        KbDocPage first = shortTtlService.list(testProjectId, null, null, 1, 20, null);
        assertEquals("ttl-old", first.getItems().get(0).getName());

        jdbcTemplate.update("update kb_doc set name = ? where id = ?", "ttl-new", saved.getId());
        sleepMillis(1200);

        KbDocPage second = shortTtlService.list(testProjectId, null, null, 1, 20, null);
        assertEquals("ttl-new", second.getItems().get(0).getName());
    }

    private KbDocQueryCache buildKbDocQueryCache(int ttlSeconds) {
        KbDocCacheProperties kbDocCacheProperties = new KbDocCacheProperties();
        kbDocCacheProperties.setListTtlSeconds(ttlSeconds);
        kbDocCacheProperties.setOptionsTtlSeconds(ttlSeconds);
        kbDocCacheProperties.setDetailTtlSeconds(ttlSeconds);
        kbDocCacheProperties.setChunksTtlSeconds(ttlSeconds);
        kbDocCacheProperties.setRecentTtlSeconds(ttlSeconds);
        return new RedisKbDocQueryCache(
                redisCacheSupport,
                stringRedisTemplate,
                new ObjectMapper(),
                kbDocCacheProperties
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
