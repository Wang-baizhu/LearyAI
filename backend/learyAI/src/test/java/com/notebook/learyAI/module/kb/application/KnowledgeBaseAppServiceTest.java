// Responsibility: Verify KnowledgeBaseAppService high-value write/use-case branches.
package com.notebook.learyAI.module.kb.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.kb.application.cache.KnowledgeBaseQueryCache;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kb.domain.service.KnowledgeBaseDomainService;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.visit.application.UserResourceVisitAppService;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseAppServiceTest {
    private static final String PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";
    private static final String KB_ID = "2f63f9ed-544e-4d72-8f68-f95f3df36f53";
    private static final Long USER_ID = 1L;

    @Mock
    private KnowledgeBaseRepository repository;
    @Mock
    private KbDocRelationRepository relationRepository;
    @Mock
    private KbDocRepository docRepository;
    @Mock
    private UserResourceVisitAppService visitAppService;
    @Mock
    private KnowledgeBaseAccessSupport accessSupport;
    @Mock
    private AuthzSdk authzSdk;
    @Mock
    private KnowledgeBaseQueryCache knowledgeBaseQueryCache;
    @Spy
    private KnowledgeBaseDomainService domainService = new KnowledgeBaseDomainService();

    @InjectMocks
    private KnowledgeBaseAppService knowledgeBaseAppService;

    @Test
    @DisplayName("recordVisit 在 visitedAt 为空时应回填当前时间并写入访问记录")
    void recordVisit_nullVisitedAt_shouldFallbackToNow() {
        KnowledgeBase kb = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb", "d", List.of(), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null);
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(repository.findByKbId(KB_ID, PROJECT_ID)).thenReturn(Optional.of(kb));

        knowledgeBaseAppService.recordVisit(PROJECT_ID, KB_ID, null);

        ArgumentCaptor<Instant> timeCaptor = ArgumentCaptor.forClass(Instant.class);
        verify(repository).updateVisitedAt(eq(10L), timeCaptor.capture());
        assertNotNull(timeCaptor.getValue());
        verify(visitAppService).recordVisit(USER_ID, UserResourceType.PROJECT, PROJECT_ID, timeCaptor.getValue());
        verify(visitAppService).recordVisit(USER_ID, UserResourceType.KB, KB_ID, timeCaptor.getValue());
        verify(knowledgeBaseQueryCache).evictRecent(PROJECT_ID, USER_ID);
    }

    @Test
    @DisplayName("create 同项目重名时应返回 KB-409")
    void create_duplicateName_shouldThrowKb409() {
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any(Set.class))).thenReturn(ProjectRole.ADMIN);
        when(repository.existsByNameAndProjectId("kb-name", PROJECT_ID)).thenReturn(true);

        BizException ex = assertThrows(BizException.class, () -> knowledgeBaseAppService.create(
                PROJECT_ID, "kb-name", "desc", List.of("a"), KnowledgeBaseVisibility.PRIVATE, null));

        assertEquals("KB-409", ex.getCode());
    }

    @Test
    @DisplayName("create 成功时应保存并失效项目缓存")
    void create_success_shouldSaveAndEvictProjectCache() {
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any(Set.class))).thenReturn(ProjectRole.OWNER);
        when(repository.existsByNameAndProjectId("kb-a", PROJECT_ID)).thenReturn(false);
        KnowledgeBase saved = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb-a", "d", List.of("x"), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null);
        when(repository.save(any(KnowledgeBase.class))).thenReturn(saved);

        KnowledgeBase result = knowledgeBaseAppService.create(
                PROJECT_ID, " kb-a ", " d ", List.of("x", "x"), KnowledgeBaseVisibility.PRIVATE, null);

        assertSame(saved, result);
        verify(knowledgeBaseQueryCache).evictByProject(PROJECT_ID);
    }

    @Test
    @DisplayName("create 应允许未安装但项目可用的插件")
    void create_shouldAcceptAvailablePluginWithoutInstallation() {
        String pluginId = "33333333-3333-3333-3333-333333333333";
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any(Set.class))).thenReturn(ProjectRole.OWNER);
        when(repository.existsByNameAndProjectId("kb-a", PROJECT_ID)).thenReturn(false);
        KnowledgeBase saved = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb-a", "d", List.of("x"), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null, java.util.Map.of(), List.of(pluginId));
        when(repository.save(any(KnowledgeBase.class))).thenReturn(saved);

        KnowledgeBase result = knowledgeBaseAppService.create(
                PROJECT_ID, "kb-a", "d", List.of("x"), KnowledgeBaseVisibility.PRIVATE, List.of(pluginId));

        assertSame(saved, result);
        verify(repository).save(any(KnowledgeBase.class));
    }

    @Test
    @DisplayName("create 传入空插件数组时应忽略模板插件配置")
    void create_emptyPluginIds_shouldIgnorePluginIds() {
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any(Set.class))).thenReturn(ProjectRole.OWNER);
        when(repository.existsByNameAndProjectId("kb-empty", PROJECT_ID)).thenReturn(false);
        KnowledgeBase saved = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb-empty", "d", List.of("x"), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null, java.util.Map.of(), List.of());
        when(repository.save(any(KnowledgeBase.class))).thenReturn(saved);

        KnowledgeBase result = knowledgeBaseAppService.create(
                PROJECT_ID, "kb-empty", "d", List.of("x"), KnowledgeBaseVisibility.PRIVATE, List.of());

        assertSame(saved, result);
        verify(repository).save(any(KnowledgeBase.class));
    }

    @Test
    @DisplayName("update 非 owner 应返回 KB-403")
    void update_whenNotOwner_shouldThrowKb403() {
        KnowledgeBase kb = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb", "d", List.of(), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null);
        when(authzSdk.requireUserId()).thenReturn(2L);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(repository.findByKbId(KB_ID, PROJECT_ID)).thenReturn(Optional.of(kb));

        BizException ex = assertThrows(BizException.class, () -> knowledgeBaseAppService.update(
                PROJECT_ID, KB_ID, "name", "desc", List.of("a"), KnowledgeBaseVisibility.PUBLIC, null));
        assertEquals("KB-403", ex.getCode());
    }

    @Test
    @DisplayName("update 传入空插件数组时应忽略模板插件配置")
    void update_emptyPluginIds_shouldIgnorePluginIds() {
        KnowledgeBase existing = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb", "d", List.of(), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null, java.util.Map.of(), List.of("plugin-a"));
        KnowledgeBase saved = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb", "d", List.of(), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null, java.util.Map.of(), List.of());
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(repository.findByKbId(KB_ID, PROJECT_ID)).thenReturn(Optional.of(existing));
        when(repository.save(any(KnowledgeBase.class))).thenReturn(saved);

        KnowledgeBase result = knowledgeBaseAppService.update(
                PROJECT_ID, KB_ID, null, null, null, null, List.of());

        assertSame(saved, result);
        verify(repository).save(any(KnowledgeBase.class));
    }

    @Test
    @DisplayName("update 保留历史模板插件参数时应直接忽略")
    void update_retainedUnavailablePluginIds_shouldBeIgnored() {
        String retainedPluginId = "33333333-3333-3333-3333-333333333333";
        KnowledgeBase existing = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb", "d", List.of(), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null, java.util.Map.of(), List.of(retainedPluginId));
        KnowledgeBase saved = existing.withEnabledTemplatePluginIds(List.of(retainedPluginId));
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(repository.findByKbId(KB_ID, PROJECT_ID)).thenReturn(Optional.of(existing));
        when(repository.save(any(KnowledgeBase.class))).thenReturn(saved);

        KnowledgeBase result = knowledgeBaseAppService.update(
                PROJECT_ID, KB_ID, null, null, null, null, List.of(retainedPluginId));

        assertSame(saved, result);
        verify(repository).save(any(KnowledgeBase.class));
    }

    @Test
    @DisplayName("delete 成功应删除知识库并失效项目缓存")
    void delete_success_shouldDeleteAndEvictProjectCache() {
        KnowledgeBase kb = new KnowledgeBase(10L, KB_ID, PROJECT_ID, "kb", "d", List.of(), USER_ID,
                KnowledgeBaseVisibility.PRIVATE, null);
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(repository.findByKbId(KB_ID, PROJECT_ID)).thenReturn(Optional.of(kb));
        when(repository.findById(10L, PROJECT_ID)).thenReturn(Optional.of(kb));
        when(relationRepository.findDocIdsByKbId(PROJECT_ID, 10L)).thenReturn(List.of());

        knowledgeBaseAppService.delete(PROJECT_ID, KB_ID);

        verify(repository).deleteById(10L);
        verify(visitAppService).deleteByResource(UserResourceType.KB, KB_ID);
        verify(knowledgeBaseQueryCache).evictByProject(PROJECT_ID);
    }

    @Test
    @DisplayName("list 参数边界：非法分页应返回 KB-400")
    void list_invalidPagination_shouldThrowKb400() {
        BizException ex = assertThrows(BizException.class,
                () -> knowledgeBaseAppService.list(PROJECT_ID, null, null, null, null, 0, 20));
        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("list 应按参数透传查询并返回结果")
    void list_shouldDelegateSearchWithNormalizedArgs() {
        when(authzSdk.requireProjectId(PROJECT_ID, "KB-400", "KB-400", "KB-404")).thenReturn(PROJECT_ID);
        when(authzSdk.requireUserId()).thenReturn(USER_ID);
        when(authzSdk.isMember(USER_ID, PROJECT_ID)).thenReturn(true);
        KnowledgeBasePage page = new KnowledgeBasePage(List.of(), 0, 1, 20);
        when(repository.search(PROJECT_ID, USER_ID, true, "abc", "tag1",
                com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort.VISITED_AT, false, 1, 20))
                .thenReturn(page);
        when(knowledgeBaseQueryCache.getList(PROJECT_ID, USER_ID, true, "abc", "tag1",
                com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort.VISITED_AT, false, 1, 20))
                .thenReturn(com.notebook.learyAI.module.kb.application.cache.CachedValue.miss());

        KnowledgeBasePage result = knowledgeBaseAppService.list(
                PROJECT_ID, " abc ", " tag1 ", "updated_at", "asc", 1, 20);

        assertSame(page, result);
    }
}
