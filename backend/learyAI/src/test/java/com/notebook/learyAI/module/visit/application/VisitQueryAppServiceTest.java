// Responsibility: Verify recent-visit query orchestration, paging, and validation behavior.
package com.notebook.learyAI.module.visit.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;
import com.notebook.learyAI.module.visit.domain.repository.UserResourceVisitRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VisitQueryAppServiceTest {
    @Mock
    private UserResourceVisitRepository repository;
    @Mock
    private AuthzSdk authzSdk;
    @Mock
    private VisitResourceSummaryReader projectReader;
    @Mock
    private VisitResourceSummaryReader kbReader;

    @Test
    @DisplayName("listRecent: size 非法时应返回 VISIT-400")
    void listRecent_whenSizeInvalid_shouldThrowVisit400() {
        VisitQueryAppService appService = new VisitQueryAppService(repository, authzSdk, List.of());
        when(authzSdk.requireUserId()).thenReturn(7L);

        BizException ex = assertThrows(BizException.class, () -> appService.listRecent(0, null));

        assertEquals("VISIT-400", ex.getCode());
    }

    @Test
    @DisplayName("listRecent: cursor 非法时应返回 VISIT-400")
    void listRecent_whenCursorInvalid_shouldThrowVisit400() {
        VisitQueryAppService appService = new VisitQueryAppService(repository, authzSdk, List.of());
        when(authzSdk.requireUserId()).thenReturn(7L);

        BizException ex = assertThrows(BizException.class, () -> appService.listRecent(20, "invalid-cursor"));

        assertEquals("VISIT-400", ex.getCode());
    }

    @Test
    @DisplayName("listRecent: 应分页聚合摘要并返回 nextCursor")
    void listRecent_shouldAssemblePageAndCursor() {
        when(projectReader.supports(UserResourceType.PROJECT)).thenReturn(true);
        when(projectReader.supports(UserResourceType.KB)).thenReturn(false);
        when(kbReader.supports(UserResourceType.PROJECT)).thenReturn(false);
        when(kbReader.supports(UserResourceType.KB)).thenReturn(true);
        VisitQueryAppService appService = new VisitQueryAppService(repository, authzSdk, List.of(projectReader, kbReader));
        when(authzSdk.requireUserId()).thenReturn(9L);

        Instant t3 = Instant.parse("2026-03-30T10:03:00Z");
        Instant t2 = Instant.parse("2026-03-30T10:02:00Z");
        Instant t1 = Instant.parse("2026-03-30T10:01:00Z");
        when(repository.findRecentByUser(9L, null, null, 3)).thenReturn(List.of(
                new UserResourceVisit(30L, 9L, UserResourceType.PROJECT, "project-1", t3, t3, t3),
                new UserResourceVisit(20L, 9L, UserResourceType.KB, "kb-1", t2, t2, t2),
                new UserResourceVisit(10L, 9L, UserResourceType.KB, "kb-2", t1, t1, t1)
        ));
        when(projectReader.loadSummaries(9L, List.of("project-1")))
                .thenReturn(Map.of("project-1", new VisitResourceSummary("项目A", null, "project-1", null)));
        when(kbReader.loadSummaries(9L, List.of("kb-1")))
                .thenReturn(Map.of());

        VisitQueryAppService.RecentVisitPageView page = appService.listRecent(2, null);

        assertEquals(2, page.getItems().size());
        assertTrue(page.isHasMore());
        assertNotNull(page.getNextCursor());
        assertEquals(encodeCursor(t2, 20L), page.getNextCursor());
        assertEquals("PROJECT", page.getItems().get(0).getResourceType());
        assertTrue(page.getItems().get(0).isAvailable());
        assertEquals("项目A", page.getItems().get(0).getTitle());
        assertEquals("KB", page.getItems().get(1).getResourceType());
        assertFalse(page.getItems().get(1).isAvailable());
        assertNull(page.getItems().get(1).getTitle());
    }

    @Test
    @DisplayName("listRecent: 传入 cursor 时应透传到仓储查询条件")
    void listRecent_whenCursorProvided_shouldPassCursorToRepository() {
        when(projectReader.supports(UserResourceType.PROJECT)).thenReturn(true);
        when(projectReader.supports(UserResourceType.KB)).thenReturn(true);
        VisitQueryAppService appService = new VisitQueryAppService(repository, authzSdk, List.of(projectReader));
        when(authzSdk.requireUserId()).thenReturn(9L);
        when(repository.findRecentByUser(anyLong(), eq(Instant.parse("2026-03-30T10:00:00Z")), eq(88L), eq(21)))
                .thenReturn(List.of());

        VisitQueryAppService.RecentVisitPageView page = appService.listRecent(20, encodeCursor(
                Instant.parse("2026-03-30T10:00:00Z"), 88L
        ));

        ArgumentCaptor<Instant> timeCaptor = ArgumentCaptor.forClass(Instant.class);
        ArgumentCaptor<Long> idCaptor = ArgumentCaptor.forClass(Long.class);
        verify(repository).findRecentByUser(eq(9L), timeCaptor.capture(), idCaptor.capture(), eq(21));
        assertEquals(Instant.parse("2026-03-30T10:00:00Z"), timeCaptor.getValue());
        assertEquals(88L, idCaptor.getValue());
        assertTrue(page.getItems().isEmpty());
        assertFalse(page.isHasMore());
        assertNull(page.getNextCursor());
    }

    private String encodeCursor(Instant visitedAt, Long id) {
        String raw = visitedAt.toEpochMilli() + "_" + id;
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }
}
