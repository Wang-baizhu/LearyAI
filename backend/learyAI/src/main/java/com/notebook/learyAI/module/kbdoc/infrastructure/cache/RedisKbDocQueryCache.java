// Responsibility: Implement kb-doc query cache with Redis.
package com.notebook.learyAI.module.kbdoc.infrastructure.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.kbdoc.application.cache.CachedValue;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunk;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component("redisKbDocQueryCacheDelegate")
public class RedisKbDocQueryCache implements KbDocQueryCache {
    private static final String PREFIX_LIST = "kbdoc:list:";
    private static final String PREFIX_DETAIL = "kbdoc:detail:";
    private static final String PREFIX_CHUNKS = "kbdoc:chunks:";
    private static final String PREFIX_RECENT = "kbdoc:recent:";
    private static final String PREFIX_OPTIONS = "kbdoc:options:";
    private static final String NULL_SEGMENT = "~";

    private final RedisCacheSupport cacheSupport;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final KbDocCacheProperties properties;

    public RedisKbDocQueryCache(RedisCacheSupport cacheSupport,
                                StringRedisTemplate stringRedisTemplate,
                                ObjectMapper objectMapper,
                                KbDocCacheProperties properties) {
        this.cacheSupport = cacheSupport;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    public CachedValue<KbDocPage> getList(String projectId, long userId, String search, String fileType, int page, int size,
                                          String kbId) {
        if (isBlank(projectId) || userId <= 0 || page <= 0 || size <= 0) {
            return CachedValue.miss();
        }
        String key = listKey(projectId, userId, search, fileType, page, size, kbId);
        return cacheSupport.get(key)
                .flatMap(this::readDocPage)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putList(String projectId, long userId, String search, String fileType, int page, int size, String kbId,
                        KbDocPage pageResult) {
        if (isBlank(projectId) || userId <= 0 || page <= 0 || size <= 0 || pageResult == null) {
            return;
        }
        String key = listKey(projectId, userId, search, fileType, page, size, kbId);
        writeJson(key, toPayload(pageResult), Duration.ofSeconds(Math.max(1, properties.getListTtlSeconds())));
    }

    @Override
    public CachedValue<List<KbDocOption>> getDocOptions(String projectId, long userId, String search, String kbId) {
        if (isBlank(projectId) || userId <= 0) {
            return CachedValue.miss();
        }
        String key = optionsKey(projectId, userId, search, kbId);
        return cacheSupport.get(key)
                .flatMap(this::readDocOptions)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putDocOptions(String projectId, long userId, String search, String kbId, List<KbDocOption> options) {
        if (isBlank(projectId) || userId <= 0 || options == null) {
            return;
        }
        String key = optionsKey(projectId, userId, search, kbId);
        writeJson(key, toPayload(options), Duration.ofSeconds(Math.max(1, properties.getOptionsTtlSeconds())));
    }

    @Override
    public CachedValue<KbDoc> getDetail(String projectId, String docId, long userId) {
        if (isBlank(projectId) || isBlank(docId) || userId <= 0) {
            return CachedValue.miss();
        }
        String key = detailKey(projectId, docId, userId);
        return cacheSupport.get(key)
                .flatMap(this::readDoc)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putDetail(String projectId, String docId, long userId, KbDoc doc) {
        if (isBlank(projectId) || isBlank(docId) || userId <= 0 || doc == null) {
            return;
        }
        String key = detailKey(projectId, docId, userId);
        writeJson(key, toPayload(doc), Duration.ofSeconds(Math.max(1, properties.getDetailTtlSeconds())));
    }

    @Override
    public CachedValue<KbDocTextChunkPage> getChunks(String projectId, String docId, int startChunkSec, int size, long userId) {
        if (isBlank(projectId) || isBlank(docId) || startChunkSec <= 0 || size <= 0 || userId <= 0) {
            return CachedValue.miss();
        }
        String key = chunksKey(projectId, docId, startChunkSec, size, userId);
        return cacheSupport.get(key)
                .flatMap(this::readChunkPage)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putChunks(String projectId, String docId, int startChunkSec, int size, long userId, KbDocTextChunkPage chunks) {
        if (isBlank(projectId) || isBlank(docId) || startChunkSec <= 0 || size <= 0 || userId <= 0
                || chunks == null) {
            return;
        }
        String key = chunksKey(projectId, docId, startChunkSec, size, userId);
        writeJson(key, toPayload(chunks), Duration.ofSeconds(Math.max(1, properties.getChunksTtlSeconds())));
    }

    @Override
    public CachedValue<List<String>> getRecentIds(String projectId, int limit, long userId) {
        if (isBlank(projectId) || limit <= 0 || userId <= 0) {
            return CachedValue.miss();
        }
        String key = recentKey(projectId, limit, userId);
        return cacheSupport.get(key)
                .flatMap(this::readRecentIds)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putRecentIds(String projectId, int limit, long userId, List<String> docIds) {
        if (isBlank(projectId) || limit <= 0 || userId <= 0 || docIds == null) {
            return;
        }
        String key = recentKey(projectId, limit, userId);
        writeJson(key, docIds, Duration.ofSeconds(Math.max(1, properties.getRecentTtlSeconds())));
    }

    @Override
    public void evictProject(String projectId) {
        if (isBlank(projectId)) {
            return;
        }
        deleteByPattern(PREFIX_LIST + projectId + ":*");
        deleteByPattern(PREFIX_DETAIL + projectId + ":*");
        deleteByPattern(PREFIX_CHUNKS + projectId + ":*");
        deleteByPattern(PREFIX_RECENT + projectId + ":*");
        deleteByPattern(PREFIX_OPTIONS + projectId + ":*");
    }

    @Override
    public void evictDoc(String projectId, long docInternalId, String docId) {
        if (isBlank(projectId)) {
            return;
        }
        deleteByPattern(PREFIX_LIST + projectId + ":*");
        deleteByPattern(PREFIX_RECENT + projectId + ":*");
        deleteByPattern(PREFIX_OPTIONS + projectId + ":*");
        if (!isBlank(docId)) {
            deleteByPattern(PREFIX_DETAIL + projectId + ":" + docId + ":*");
        } else {
            deleteByPattern(PREFIX_DETAIL + projectId + ":*");
        }
        if (!isBlank(docId)) {
            deleteByPattern(PREFIX_CHUNKS + projectId + ":" + docId + ":*");
        }
    }

    @Override
    public void evictDocByDocId(String projectId, String docId) {
        if (isBlank(projectId)) {
            return;
        }
        deleteByPattern(PREFIX_LIST + projectId + ":*");
        deleteByPattern(PREFIX_RECENT + projectId + ":*");
        deleteByPattern(PREFIX_OPTIONS + projectId + ":*");
        deleteByPattern(PREFIX_DETAIL + projectId + ":*");
        if (!isBlank(docId)) {
            deleteByPattern(PREFIX_CHUNKS + projectId + ":" + docId + ":*");
        }
    }

    private void deleteByPattern(String pattern) {
        Set<String> keys = stringRedisTemplate.keys(pattern);
        if (keys == null || keys.isEmpty()) {
            return;
        }
        cacheSupport.deleteAfterCommit(keys);
    }

    private void writeJson(String key, Object payload, Duration ttl) {
        try {
            cacheSupport.put(key, objectMapper.writeValueAsString(payload), ttl);
        } catch (JsonProcessingException ex) {
            cacheSupport.delete(key);
        }
    }

    private java.util.Optional<KbDocPage> readDocPage(String raw) {
        try {
            return java.util.Optional.of(fromPayload(objectMapper.readValue(raw, KbDocPagePayload.class)));
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private java.util.Optional<KbDoc> readDoc(String raw) {
        try {
            return java.util.Optional.of(fromPayload(objectMapper.readValue(raw, KbDocPayload.class)));
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private java.util.Optional<KbDocTextChunkPage> readChunkPage(String raw) {
        try {
            return java.util.Optional.of(fromPayload(objectMapper.readValue(raw, KbDocTextChunkPagePayload.class)));
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private java.util.Optional<List<String>> readRecentIds(String raw) {
        try {
            return java.util.Optional.of(objectMapper.readValue(raw, new TypeReference<>() { }));
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private java.util.Optional<List<KbDocOption>> readDocOptions(String raw) {
        try {
            List<KbDocOptionPayload> payloads = objectMapper.readValue(raw, new TypeReference<>() { });
            List<KbDocOption> options = new ArrayList<>();
            for (KbDocOptionPayload payload : payloads) {
                if (payload == null) {
                    continue;
                }
                options.add(new KbDocOption(payload.docId, payload.name, payload.status));
            }
            return java.util.Optional.of(options);
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private KbDocPagePayload toPayload(KbDocPage page) {
        KbDocPagePayload payload = new KbDocPagePayload();
        payload.total = page.getTotal();
        payload.page = page.getPage();
        payload.size = page.getSize();
        payload.items = new ArrayList<>();
        if (page.getItems() != null) {
            for (KbDoc item : page.getItems()) {
                payload.items.add(toPayload(item));
            }
        }
        return payload;
    }

    private KbDocPayload toPayload(KbDoc doc) {
        KbDocPayload payload = new KbDocPayload();
        payload.id = doc.getId();
        payload.projectId = doc.getProjectId();
        payload.docId = doc.getDocId();
        payload.name = doc.getName();
        payload.fileType = doc.getFileType();
        payload.size = doc.getSize();
        payload.objectKey = doc.getObjectKey();
        payload.storageProvider = doc.getStorageProvider();
        payload.originUrl = doc.getOriginUrl();
        payload.metadata = doc.getMetadata();
        payload.status = doc.getStatus();
        payload.createdAtEpochMilli = toEpochMilli(doc.getCreatedAt());
        payload.updatedAtEpochMilli = toEpochMilli(doc.getUpdatedAt());
        return payload;
    }

    private KbDocTextChunkPagePayload toPayload(KbDocTextChunkPage chunkPage) {
        KbDocTextChunkPagePayload payload = new KbDocTextChunkPagePayload();
        payload.hasMore = chunkPage.isHasMore();
        payload.nextChunkSec = chunkPage.getNextChunkSec();
        payload.items = new ArrayList<>();
        if (chunkPage.getItems() != null) {
            for (KbDocTextChunk item : chunkPage.getItems()) {
                KbDocTextChunkPayload chunkPayload = new KbDocTextChunkPayload();
                chunkPayload.chunkSec = item.getChunkSec();
                chunkPayload.text = item.getText();
                payload.items.add(chunkPayload);
            }
        }
        return payload;
    }

    private List<KbDocOptionPayload> toPayload(List<KbDocOption> options) {
        List<KbDocOptionPayload> payloads = new ArrayList<>();
        for (KbDocOption option : options) {
            if (option == null) {
                continue;
            }
            KbDocOptionPayload payload = new KbDocOptionPayload();
            payload.docId = option.getDocId();
            payload.name = option.getName();
            payload.status = option.getStatus();
            payloads.add(payload);
        }
        return payloads;
    }

    private KbDocPage fromPayload(KbDocPagePayload payload) {
        List<KbDoc> items = new ArrayList<>();
        if (payload.items != null) {
            for (KbDocPayload item : payload.items) {
                items.add(fromPayload(item));
            }
        }
        return new KbDocPage(items, payload.total, payload.page, payload.size);
    }

    private KbDoc fromPayload(KbDocPayload payload) {
        return new KbDoc(
                payload.id,
                payload.projectId,
                payload.docId,
                payload.name,
                payload.fileType,
                payload.size,
                payload.objectKey,
                payload.storageProvider,
                payload.originUrl,
                payload.metadata,
                payload.status,
                toInstant(payload.createdAtEpochMilli),
                toInstant(payload.updatedAtEpochMilli)
        );
    }

    private KbDocTextChunkPage fromPayload(KbDocTextChunkPagePayload payload) {
        List<KbDocTextChunk> items = new ArrayList<>();
        if (payload.items != null) {
            for (KbDocTextChunkPayload item : payload.items) {
                items.add(new KbDocTextChunk(item.chunkSec, item.text));
            }
        }
        return new KbDocTextChunkPage(items, payload.hasMore, payload.nextChunkSec);
    }

    private long toEpochMilli(Instant value) {
        return value == null ? 0L : value.toEpochMilli();
    }

    private Instant toInstant(long value) {
        return value <= 0 ? null : Instant.ofEpochMilli(value);
    }

    private String listKey(String projectId, long userId, String search, String fileType, int page, int size, String kbId) {
        return PREFIX_LIST + projectId + ":" + userId + ":" + encode(search) + ":" + encode(fileType) + ":" + page
                + ":" + size + ":" + encode(kbId);
    }

    private String detailKey(String projectId, String docId, long userId) {
        return PREFIX_DETAIL + projectId + ":" + docId + ":" + userId;
    }

    private String chunksKey(String projectId, String docId, int startChunkSec, int size, long userId) {
        return PREFIX_CHUNKS + projectId + ":" + docId + ":" + startChunkSec + ":" + size + ":" + userId;
    }

    private String recentKey(String projectId, int limit, long userId) {
        return PREFIX_RECENT + projectId + ":" + limit + ":" + userId;
    }

    private String optionsKey(String projectId, long userId, String search, String kbId) {
        return PREFIX_OPTIONS + projectId + ":" + userId + ":" + encode(search) + ":" + encode(kbId);
    }

    private String encode(String value) {
        if (value == null || value.isBlank()) {
            return NULL_SEGMENT;
        }
        return Base64.getUrlEncoder().withoutPadding()
                .encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static class KbDocPagePayload {
        public List<KbDocPayload> items;
        public long total;
        public int page;
        public int size;
    }

    private static class KbDocPayload {
        public Long id;
        public String projectId;
        public String docId;
        public String name;
        public String fileType;
        public Long size;
        public String objectKey;
        public String storageProvider;
        public String originUrl;
        public Map<String, Object> metadata;
        public String status;
        public long createdAtEpochMilli;
        public long updatedAtEpochMilli;
    }

    private static class KbDocTextChunkPagePayload {
        public List<KbDocTextChunkPayload> items;
        public boolean hasMore;
        public Integer nextChunkSec;
    }

    private static class KbDocTextChunkPayload {
        public Integer chunkSec;
        public String text;
    }

    private static class KbDocOptionPayload {
        public String docId;
        public String name;
        public String status;
    }
}
