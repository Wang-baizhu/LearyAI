// Responsibility: Verify knowledge base visibility checks delegate team access to AuthzSdk membership.
package com.notebook.learyAI.module.kb.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KnowledgeBaseAccessSupportTest {
    @Mock
    private AuthzSdk authzSdk;

    @InjectMocks
    private KnowledgeBaseAccessSupport accessSupport;

    @Test
    @DisplayName("TEAM 可见性下成员访问应通过")
    void ensureAccess_teamVisibility_member_shouldPass() {
        KnowledgeBase kb = new KnowledgeBase(1L, "kb-1", "p1", "name", null, List.of(), 10L, KnowledgeBaseVisibility.TEAM, null);
        when(authzSdk.isMember(20L, "p1")).thenReturn(true);

        assertDoesNotThrow(() -> accessSupport.ensureAccess(kb, 20L));
    }

    @Test
    @DisplayName("TEAM 可见性下非成员访问应返回 KB-404")
    void ensureAccess_teamVisibility_nonMember_shouldThrowKb404() {
        KnowledgeBase kb = new KnowledgeBase(1L, "kb-1", "p1", "name", null, List.of(), 10L, KnowledgeBaseVisibility.TEAM, null);
        when(authzSdk.isMember(20L, "p1")).thenReturn(false);

        BizException ex = assertThrows(BizException.class, () -> accessSupport.ensureAccess(kb, 20L));
        assertEquals("KB-404", ex.getCode());
    }

    @Test
    @DisplayName("PUBLIC 可见性应允许访问")
    void ensureAccess_publicVisibility_shouldPass() {
        KnowledgeBase kb = new KnowledgeBase(1L, "kb-1", "p1", "name", null, List.of(), 10L, KnowledgeBaseVisibility.PUBLIC, null);

        assertDoesNotThrow(() -> accessSupport.ensureAccess(kb, 20L));
        verifyNoInteractions(authzSdk);
    }

    @Test
    @DisplayName("PRIVATE 可见性下 owner 访问应通过，非 owner 返回 KB-404")
    void ensureAccess_privateVisibility_ownerAndNonOwner() {
        KnowledgeBase kb = new KnowledgeBase(1L, "kb-1", "p1", "name", null, List.of(), 10L, KnowledgeBaseVisibility.PRIVATE, null);

        assertDoesNotThrow(() -> accessSupport.ensureAccess(kb, 10L));
        BizException ex = assertThrows(BizException.class, () -> accessSupport.ensureAccess(kb, 20L));
        assertEquals("KB-404", ex.getCode());
        verifyNoInteractions(authzSdk);
    }

    @Test
    @DisplayName("TEAM 可见性下未登录 userId(0) 访问应拒绝 KB-404")
    void ensureAccess_teamVisibility_guestUser_shouldThrowKb404() {
        KnowledgeBase kb = new KnowledgeBase(1L, "kb-1", "p1", "name", null, List.of(), 10L, KnowledgeBaseVisibility.TEAM, null);
        when(authzSdk.isMember(0L, "p1")).thenReturn(false);

        BizException ex = assertThrows(BizException.class, () -> accessSupport.ensureAccess(kb, 0L));
        assertEquals("KB-404", ex.getCode());
        verify(authzSdk).isMember(0L, "p1");
    }

    @Test
    @DisplayName("TEAM 可见性下 owner 但非成员应拒绝 KB-404")
    void ensureAccess_teamVisibility_ownerButNotMember_shouldThrowKb404() {
        KnowledgeBase kb = new KnowledgeBase(1L, "kb-1", "p1", "name", null, List.of(), 10L, KnowledgeBaseVisibility.TEAM, null);
        when(authzSdk.isMember(10L, "p1")).thenReturn(false);

        BizException ex = assertThrows(BizException.class, () -> accessSupport.ensureAccess(kb, 10L));
        assertEquals("KB-404", ex.getCode());
        verify(authzSdk).isMember(10L, "p1");
    }
}
