// Responsibility: Aggregate recent visit data into paged content views.
package com.notebook.learyAI.module.visit.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;
import com.notebook.learyAI.module.visit.domain.repository.UserResourceVisitRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.EnumMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Service
public class VisitQueryAppService {
    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 50;

    private final UserResourceVisitRepository repository;
    private final AuthzSdk authzSdk;
    private final Map<UserResourceType, VisitResourceSummaryReader> readers;

    public VisitQueryAppService(UserResourceVisitRepository repository,
                                AuthzSdk authzSdk,
                                List<VisitResourceSummaryReader> readerList) {
        this.repository = repository;
        this.authzSdk = authzSdk;
        this.readers = new EnumMap<>(UserResourceType.class);
        for (VisitResourceSummaryReader reader : readerList) {
            for (UserResourceType resourceType : UserResourceType.values()) {
                if (reader.supports(resourceType)) {
                    readers.put(resourceType, reader);
                }
            }
        }
    }

    public RecentVisitPageView listRecent(Integer size, String cursor) {
        Long userId = authzSdk.requireUserId();
        int pageSize = size == null ? DEFAULT_PAGE_SIZE : size;
        if (pageSize < 1 || pageSize > MAX_PAGE_SIZE) {
            throw new BizException("VISIT-400", "size invalid");
        }
        CursorValue cursorValue = parseCursor(cursor);
        List<UserResourceVisit> fetched = repository.findRecentByUser(
                userId, cursorValue.lastVisitedAt, cursorValue.id, pageSize + 1
        );
        boolean hasMore = fetched.size() > pageSize;
        List<UserResourceVisit> pageItems = hasMore ? fetched.subList(0, pageSize) : fetched;
        Map<UserResourceType, List<String>> idsByType = new EnumMap<>(UserResourceType.class);
        for (UserResourceVisit visit : pageItems) {
            idsByType.computeIfAbsent(visit.getResourceType(), key -> new ArrayList<>()).add(visit.getResourceId());
        }
        Map<UserResourceType, Map<String, VisitResourceSummary>> summariesByType = new EnumMap<>(UserResourceType.class);
        for (Map.Entry<UserResourceType, List<String>> entry : idsByType.entrySet()) {
            VisitResourceSummaryReader reader = readers.get(entry.getKey());
            if (reader == null) {
                summariesByType.put(entry.getKey(), Map.of());
                continue;
            }
            summariesByType.put(entry.getKey(), reader.loadSummaries(userId, deduplicate(entry.getValue())));
        }

        List<RecentVisitItemView> items = new ArrayList<>();
        for (UserResourceVisit visit : pageItems) {
            Map<String, VisitResourceSummary> summaryMap = summariesByType.getOrDefault(visit.getResourceType(), Map.of());
            VisitResourceSummary summary = summaryMap.get(visit.getResourceId());
            items.add(new RecentVisitItemView(
                    visit.getResourceType().name(),
                    visit.getResourceId(),
                    visit.getLastVisitedAt(),
                    summary != null,
                    summary == null ? null : summary.getTitle(),
                    summary == null ? null : summary.getDescription(),
                    summary == null ? null : summary.getProjectId(),
                    summary == null ? null : summary.getKbId()
            ));
        }

        String nextCursor = null;
        if (hasMore && !pageItems.isEmpty()) {
            UserResourceVisit last = pageItems.get(pageItems.size() - 1);
            nextCursor = encodeCursor(last.getLastVisitedAt(), last.getId());
        }
        return new RecentVisitPageView(items, hasMore, nextCursor);
    }

    private List<String> deduplicate(List<String> resourceIds) {
        return new ArrayList<>(new LinkedHashSet<>(resourceIds));
    }

    private CursorValue parseCursor(String cursor) {
        if (cursor == null || cursor.isBlank()) {
            return CursorValue.EMPTY;
        }
        try {
            String decoded = new String(Base64.getUrlDecoder().decode(cursor.trim()), StandardCharsets.UTF_8);
            String[] parts = decoded.split("_", 2);
            if (parts.length != 2) {
                throw new BizException("VISIT-400", "cursor invalid");
            }
            return new CursorValue(Instant.ofEpochMilli(Long.parseLong(parts[0])), Long.parseLong(parts[1]));
        } catch (IllegalArgumentException ex) {
            throw new BizException("VISIT-400", "cursor invalid");
        }
    }

    private String encodeCursor(Instant lastVisitedAt, Long id) {
        String raw = lastVisitedAt.toEpochMilli() + "_" + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    private static class CursorValue {
        private static final CursorValue EMPTY = new CursorValue(null, null);

        private final Instant lastVisitedAt;
        private final Long id;

        private CursorValue(Instant lastVisitedAt, Long id) {
            this.lastVisitedAt = lastVisitedAt;
            this.id = id;
        }
    }

    public static class RecentVisitPageView {
        private final List<RecentVisitItemView> items;
        private final boolean hasMore;
        private final String nextCursor;

        public RecentVisitPageView(List<RecentVisitItemView> items, boolean hasMore, String nextCursor) {
            this.items = items;
            this.hasMore = hasMore;
            this.nextCursor = nextCursor;
        }

        public List<RecentVisitItemView> getItems() {
            return items;
        }

        public boolean isHasMore() {
            return hasMore;
        }

        public String getNextCursor() {
            return nextCursor;
        }
    }

    public static class RecentVisitItemView {
        private final String resourceType;
        private final String resourceId;
        private final Instant visitedAt;
        private final boolean available;
        private final String title;
        private final String description;
        private final String projectId;
        private final String kbId;

        public RecentVisitItemView(String resourceType,
                                   String resourceId,
                                   Instant visitedAt,
                                   boolean available,
                                   String title,
                                   String description,
                                   String projectId,
                                   String kbId) {
            this.resourceType = resourceType;
            this.resourceId = resourceId;
            this.visitedAt = visitedAt;
            this.available = available;
            this.title = title;
            this.description = description;
            this.projectId = projectId;
            this.kbId = kbId;
        }

        public String getResourceType() {
            return resourceType;
        }

        public String getResourceId() {
            return resourceId;
        }

        public Instant getVisitedAt() {
            return visitedAt;
        }

        public boolean isAvailable() {
            return available;
        }

        public String getTitle() {
            return title;
        }

        public String getDescription() {
            return description;
        }

        public String getProjectId() {
            return projectId;
        }

        public String getKbId() {
            return kbId;
        }
    }
}
