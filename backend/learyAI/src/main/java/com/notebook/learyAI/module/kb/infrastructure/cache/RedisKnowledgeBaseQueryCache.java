// Responsibility: Implement knowledge base query cache with Redis.
package com.notebook.learyAI.module.kb.infrastructure.cache;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.kb.application.cache.CachedValue;
import com.notebook.learyAI.module.kb.application.cache.KnowledgeBaseQueryCache;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.shared.cache.RedisCacheSupport;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Set;

@Component("redisKnowledgeBaseQueryCacheDelegate")
public class RedisKnowledgeBaseQueryCache implements KnowledgeBaseQueryCache {
    private static final String PREFIX_LIST = "kb:list:";
    private static final String PREFIX_RECENT = "kb:recent:";
    private static final String PREFIX_DETAIL = "kb:detail:";
    private static final String NULL_SEGMENT = "~";

    private final RedisCacheSupport cacheSupport;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final KnowledgeBaseCacheProperties properties;

    public RedisKnowledgeBaseQueryCache(RedisCacheSupport cacheSupport,
                                        StringRedisTemplate stringRedisTemplate,
                                        ObjectMapper objectMapper,
                                        KnowledgeBaseCacheProperties properties) {
        this.cacheSupport = cacheSupport;
        this.stringRedisTemplate = stringRedisTemplate;
        this.objectMapper = objectMapper;
        this.properties = properties;
    }

    @Override
    public CachedValue<KnowledgeBasePage> getList(String projectId, long userId, boolean isMember, String search,
                                                  String tag, KnowledgeBaseSort sort, boolean desc, int page, int size) {
        if (isBlank(projectId) || userId <= 0 || page <= 0 || size <= 0) {
            return CachedValue.miss();
        }
        String key = listKey(projectId, userId, isMember, search, tag, sort, desc, page, size);
        return cacheSupport.get(key)
                .flatMap(this::readPage)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putList(String projectId, long userId, boolean isMember, String search, String tag, KnowledgeBaseSort sort,
                        boolean desc, int page, int size, KnowledgeBasePage pageResult) {
        if (isBlank(projectId) || userId <= 0 || page <= 0 || size <= 0 || pageResult == null) {
            return;
        }
        String key = listKey(projectId, userId, isMember, search, tag, sort, desc, page, size);
        writeJson(key, toPayload(pageResult), Duration.ofSeconds(Math.max(1, properties.getListTtlSeconds())));
    }

    @Override
    public CachedValue<List<KnowledgeBase>> getRecent(String projectId, long userId, int limit) {
        if (isBlank(projectId) || userId <= 0 || limit <= 0) {
            return CachedValue.miss();
        }
        String key = recentKey(projectId, userId, limit);
        return cacheSupport.get(key)
                .flatMap(this::readRecent)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putRecent(String projectId, long userId, int limit, List<KnowledgeBase> items) {
        if (isBlank(projectId) || userId <= 0 || limit <= 0 || items == null) {
            return;
        }
        String key = recentKey(projectId, userId, limit);
        List<KnowledgeBasePayload> payload = new ArrayList<>();
        for (KnowledgeBase item : items) {
            payload.add(toPayload(item));
        }
        writeJson(key, payload, Duration.ofSeconds(Math.max(1, properties.getRecentTtlSeconds())));
    }

    @Override
    public CachedValue<KnowledgeBase> getDetail(String projectId, String kbId, long userId) {
        if (isBlank(projectId) || isBlank(kbId) || userId <= 0) {
            return CachedValue.miss();
        }
        String key = detailKey(projectId, kbId, userId);
        return cacheSupport.get(key)
                .flatMap(this::readKnowledgeBase)
                .map(CachedValue::hit)
                .orElseGet(CachedValue::miss);
    }

    @Override
    public void putDetail(String projectId, String kbId, long userId, KnowledgeBase knowledgeBase) {
        if (isBlank(projectId) || isBlank(kbId) || userId <= 0 || knowledgeBase == null) {
            return;
        }
        String key = detailKey(projectId, kbId, userId);
        writeJson(key, toPayload(knowledgeBase), Duration.ofSeconds(Math.max(1, properties.getDetailTtlSeconds())));
    }

    @Override
    public void evictByProject(String projectId) {
        if (isBlank(projectId)) {
            return;
        }
        deleteByPattern(PREFIX_LIST + projectId + ":*");
        deleteByPattern(PREFIX_RECENT + projectId + ":*");
        deleteByPattern(PREFIX_DETAIL + projectId + ":*");
    }

    @Override
    public void evictRecent(String projectId, long userId) {
        if (isBlank(projectId) || userId <= 0) {
            return;
        }
        deleteByPattern(PREFIX_RECENT + projectId + ":" + userId + ":*");
    }

    @Override
    public void evictDetail(String projectId, String kbId) {
        if (isBlank(projectId) || isBlank(kbId)) {
            return;
        }
        deleteByPattern(PREFIX_DETAIL + projectId + ":" + encode(kbId) + ":*");
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

    private java.util.Optional<KnowledgeBasePage> readPage(String raw) {
        try {
            return java.util.Optional.of(fromPayload(objectMapper.readValue(raw, KnowledgeBasePagePayload.class)));
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private java.util.Optional<List<KnowledgeBase>> readRecent(String raw) {
        try {
            List<KnowledgeBasePayload> payloads = objectMapper.readValue(raw, new TypeReference<>() { });
            List<KnowledgeBase> items = new ArrayList<>();
            for (KnowledgeBasePayload payload : payloads) {
                items.add(fromPayload(payload));
            }
            return java.util.Optional.of(items);
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private java.util.Optional<KnowledgeBase> readKnowledgeBase(String raw) {
        try {
            return java.util.Optional.of(fromPayload(objectMapper.readValue(raw, KnowledgeBasePayload.class)));
        } catch (JsonProcessingException ex) {
            return java.util.Optional.empty();
        }
    }

    private KnowledgeBasePagePayload toPayload(KnowledgeBasePage page) {
        KnowledgeBasePagePayload payload = new KnowledgeBasePagePayload();
        payload.total = page.getTotal();
        payload.page = page.getPage();
        payload.size = page.getSize();
        payload.items = new ArrayList<>();
        if (page.getItems() != null) {
            for (KnowledgeBase kb : page.getItems()) {
                payload.items.add(toPayload(kb));
            }
        }
        return payload;
    }

    private KnowledgeBasePayload toPayload(KnowledgeBase knowledgeBase) {
        KnowledgeBasePayload payload = new KnowledgeBasePayload();
        payload.id = knowledgeBase.getId();
        payload.kbId = knowledgeBase.getKbId();
        payload.projectId = knowledgeBase.getProjectId();
        payload.name = knowledgeBase.getName();
        payload.description = knowledgeBase.getDescription();
        payload.tags = knowledgeBase.getTags();
        payload.ownerId = knowledgeBase.getOwnerId();
        payload.visibility = knowledgeBase.getVisibility() == null ? null : knowledgeBase.getVisibility().name();
        payload.visitedAtEpochMilli = toEpochMilli(knowledgeBase.getVisitedAt());
        return payload;
    }

    private KnowledgeBasePage fromPayload(KnowledgeBasePagePayload payload) {
        List<KnowledgeBase> items = new ArrayList<>();
        if (payload.items != null) {
            for (KnowledgeBasePayload item : payload.items) {
                items.add(fromPayload(item));
            }
        }
        return new KnowledgeBasePage(items, payload.total, payload.page, payload.size);
    }

    private KnowledgeBase fromPayload(KnowledgeBasePayload payload) {
        return new KnowledgeBase(
                payload.id,
                payload.kbId,
                payload.projectId,
                payload.name,
                payload.description,
                payload.tags,
                payload.ownerId,
                KnowledgeBaseVisibility.from(payload.visibility),
                toInstant(payload.visitedAtEpochMilli),
                java.util.Map.of()
        );
    }

    private long toEpochMilli(Instant instant) {
        return instant == null ? 0L : instant.toEpochMilli();
    }

    private Instant toInstant(long epochMilli) {
        return epochMilli <= 0 ? null : Instant.ofEpochMilli(epochMilli);
    }

    private String listKey(String projectId, long userId, boolean isMember, String search, String tag,
                           KnowledgeBaseSort sort, boolean desc, int page, int size) {
        String sortSegment = sort == null ? NULL_SEGMENT : sort.getProperty();
        return PREFIX_LIST + projectId + ":" + userId + ":" + isMember + ":" + encode(search) + ":" + encode(tag)
                + ":" + sortSegment + ":" + (desc ? "desc" : "asc") + ":" + page + ":" + size;
    }

    private String recentKey(String projectId, long userId, int limit) {
        return PREFIX_RECENT + projectId + ":" + userId + ":" + limit;
    }

    private String detailKey(String projectId, String kbId, long userId) {
        return PREFIX_DETAIL + projectId + ":" + encode(kbId) + ":" + userId;
    }

    private String encode(String value) {
        if (value == null || value.isBlank()) {
            return NULL_SEGMENT;
        }
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private static class KnowledgeBasePagePayload {
        public List<KnowledgeBasePayload> items;
        public long total;
        public int page;
        public int size;
    }

    private static class KnowledgeBasePayload {
        public Long id;
        public String kbId;
        public String projectId;
        public String name;
        public String description;
        public List<String> tags;
        public Long ownerId;
        public String visibility;
        public long visitedAtEpochMilli;
    }
}
