// Responsibility: Verify UserResourceVisitAppService validation and mapping behaviors.
package com.notebook.learyAI.module.visit.application;

import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;
import com.notebook.learyAI.module.visit.domain.repository.UserResourceVisitRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserResourceVisitAppServiceTest {
    @Mock
    private UserResourceVisitRepository repository;

    @InjectMocks
    private UserResourceVisitAppService appService;

    @Test
    @DisplayName("recordVisit: visitedAt 为空时应写入默认时间并 trim resourceId")
    void recordVisit_whenVisitedAtNull_shouldUseNowAndTrimResourceId() {
        appService.recordVisit(1L, UserResourceType.KB, "  kb-1  ", null);

        ArgumentCaptor<Instant> timeCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(repository).upsert(eq(1L), eq(UserResourceType.KB), eq("kb-1"), timeCaptor.capture());
        assertNotNull(timeCaptor.getValue());
    }

    @Test
    @DisplayName("recordVisit: 未授权时应返回 UNAUTHORIZED")
    void recordVisit_whenUserIdNull_shouldThrowUnauthorized() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.recordVisit(null, UserResourceType.KB, "kb-1", Instant.now()));
        assertEquals("UNAUTHORIZED", ex.getCode());
    }

    @Test
    @DisplayName("recordVisit: resourceType 为空时应返回 VISIT-400")
    void recordVisit_whenResourceTypeNull_shouldThrowVisit400() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.recordVisit(1L, null, "kb-1", Instant.now()));
        assertEquals("VISIT-400", ex.getCode());
    }

    @Test
    @DisplayName("recordVisit: resourceId 为空白时应返回 VISIT-400")
    void recordVisit_whenResourceIdBlank_shouldThrowVisit400() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.recordVisit(1L, UserResourceType.KB, " ", Instant.now()));
        assertEquals("VISIT-400", ex.getCode());
    }

    @Test
    @DisplayName("listRecentResourceIds: limit 非法时应返回 VISIT-400")
    void listRecentResourceIds_whenLimitInvalid_shouldThrowVisit400() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.listRecentResourceIds(1L, UserResourceType.KB, 0));
        assertEquals("VISIT-400", ex.getCode());
    }

    @Test
    @DisplayName("listRecentResourceIds: 未授权时应返回 UNAUTHORIZED")
    void listRecentResourceIds_whenUserIdNull_shouldThrowUnauthorized() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.listRecentResourceIds(null, UserResourceType.KB, 1));
        assertEquals("UNAUTHORIZED", ex.getCode());
    }

    @Test
    @DisplayName("listRecentResourceIds: resourceType 为空时应返回 VISIT-400")
    void listRecentResourceIds_whenResourceTypeNull_shouldThrowVisit400() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.listRecentResourceIds(1L, null, 1));
        assertEquals("VISIT-400", ex.getCode());
    }

    @Test
    @DisplayName("listRecentResourceIds: 应返回按仓储顺序映射后的 resourceId")
    void listRecentResourceIds_shouldMapResourceIds() {
        Instant now = Instant.now();
        when(repository.findRecentByUserAndType(1L, UserResourceType.KB, 2))
                .thenReturn(List.of(
                        new UserResourceVisit(1L, 1L, UserResourceType.KB, "kb-2", now, now, now),
                        new UserResourceVisit(2L, 1L, UserResourceType.KB, "kb-1", now, now, now)
                ));

        List<String> ids = appService.listRecentResourceIds(1L, UserResourceType.KB, 2);

        assertEquals(List.of("kb-2", "kb-1"), ids);
    }

    @Test
    @DisplayName("deleteByResource: resourceId 为空白时应返回 VISIT-400")
    void deleteByResource_whenResourceIdBlank_shouldThrowVisit400() {
        BizException ex = assertThrows(BizException.class,
                () -> appService.deleteByResource(UserResourceType.KB, " "));
        assertEquals("VISIT-400", ex.getCode());
    }

    @Test
    @DisplayName("deleteByResource: 应 trim 后调用仓储删除")
    void deleteByResource_shouldTrimAndDelegate() {
        appService.deleteByResource(UserResourceType.KB, "  kb-1  ");
        verify(repository).deleteByResource(UserResourceType.KB, "kb-1");
    }
}
