// Responsibility: Verify doc bind/unbind core permission and cleanup branches.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbDocBindingAppServiceTest {
    @Mock
    private KbDocRepository docRepository;
    @Mock
    private KbDocRelationRepository relationRepository;
    @Mock
    private StorageClient storageClient;
    @Mock
    private KbDocStorageUsageAppService kbDocStorageUsageAppService;
    @Mock
    private KbDocAppSupport support;
    @Mock
    private KbDocQueryCache kbDocQueryCache;

    @InjectMocks
    private KbDocBindingAppService appService;

    @Test
    @DisplayName("bindDoc: 非 OWNER 应拒绝 KB-403")
    void bindDoc_whenNotOwner_shouldThrowKb403() {
        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("p1")).thenReturn("p1");
        when(support.requireRole("p1", 1L)).thenReturn(ProjectRole.ADMIN);

        BizException ex = assertThrows(BizException.class, () -> appService.bindDoc("p1", "doc-1", "kb-1"));
        assertEquals("KB-403", ex.getCode());
    }

    @Test
    @DisplayName("unbindDoc: 剩余关系为 0 时应删除对象与文档")
    void unbindDoc_whenNoRelationRemain_shouldDeleteDocAndObject() {
        KbDoc doc = new KbDoc(11L, "p1", "doc-1", "n", "txt", 1L,
                "obj/p1/doc-1/file.txt", "minio", null, null, "DONE", Instant.now(), Instant.now());
        when(support.requireUserId()).thenReturn(1L);
        when(support.requireProjectId("p1")).thenReturn("p1");
        when(support.requireRole("p1", 1L)).thenReturn(ProjectRole.OWNER);
        when(support.normalizeRequired("doc-1", "docId")).thenReturn("doc-1");
        when(support.normalizeRequired("kb-1", "kbId")).thenReturn("kb-1");
        when(support.requireKbInternalId("p1", "kb-1", 1L, true)).thenReturn(101L);
        when(docRepository.findByDocId("doc-1", "p1")).thenReturn(Optional.of(doc));
        when(relationRepository.countByDocId("p1", 11L)).thenReturn(0L);
        when(support.buildObjectPrefix("obj/p1/doc-1/file.txt")).thenReturn("obj/p1/doc-1/");

        appService.unbindDoc("p1", "doc-1", "kb-1");

        verify(relationRepository).delete("p1", 101L, 11L);
        verify(kbDocStorageUsageAppService).recordDocDeleted(1L, "p1", "doc-1", "obj/p1/doc-1/file.txt", 1L,
                "unbind_last_relation");
        verify(storageClient).deletePrefix("obj/p1/doc-1/");
        verify(docRepository).deleteById(11L, "p1");
        verify(kbDocQueryCache).evictDoc("p1", 11L, "doc-1");
    }
}
