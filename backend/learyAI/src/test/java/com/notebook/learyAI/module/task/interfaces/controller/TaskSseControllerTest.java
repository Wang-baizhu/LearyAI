// Responsibility: Verify TaskSseController authz handling and SSE registration behavior.
package com.notebook.learyAI.module.task.interfaces.controller;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.task.application.push.TenantPushRegistry;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskSseControllerTest {
    @Mock
    private TenantPushRegistry tenantPushRegistry;
    @Mock
    private AuthzSdk authzSdk;

    @InjectMocks
    private TaskSseController controller;

    @Test
    @DisplayName("subscribe: 权限通过时应注册连接并解析 Last-Event-ID")
    void subscribe_whenAuthorized_shouldRegisterEmitter() {
        when(authzSdk.requireUserId()).thenReturn(1L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        when(authzSdk.requireRole(eq(1L), eq("p1"), eq(Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER))))
                .thenReturn(ProjectRole.MEMBER);

        SseEmitter emitter = controller.subscribe("p1", "kb-1", "123");

        assertNotNull(emitter);
        verify(tenantPushRegistry).register("p1", "kb-1", 1L, emitter, 123L);
    }

    @Test
    @DisplayName("subscribe: Last-Event-ID 非数字时应按 null revision 注册")
    void subscribe_whenLastEventIdInvalid_shouldUseNullRevision() {
        when(authzSdk.requireUserId()).thenReturn(1L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        when(authzSdk.requireRole(eq(1L), eq("p1"), eq(Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER))))
                .thenReturn(ProjectRole.ADMIN);

        SseEmitter emitter = controller.subscribe("p1", "kb-1", "not-number");

        ArgumentCaptor<Long> revisionCaptor = ArgumentCaptor.forClass(Long.class);
        verify(tenantPushRegistry).register(eq("p1"), eq("kb-1"), eq(1L), eq(emitter), revisionCaptor.capture());
        assertNull(revisionCaptor.getValue());
    }

    @Test
    @DisplayName("subscribe: authz 返回 PROJECT-403 时应转换为 KB-403")
    void subscribe_whenProject403_shouldThrowKb403() {
        when(authzSdk.requireUserId()).thenReturn(1L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        when(authzSdk.requireRole(eq(1L), eq("p1"), eq(Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER))))
                .thenThrow(new BizException("PROJECT-403", "forbidden"));

        BizException ex = assertThrows(BizException.class, () -> controller.subscribe("p1", "kb-1", null));
        assertEquals("KB-403", ex.getCode());
    }

    @Test
    @DisplayName("subscribe: 非 PROJECT-403 错误码应透传")
    void subscribe_whenOtherBizError_shouldPropagate() {
        when(authzSdk.requireUserId()).thenReturn(1L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        when(authzSdk.requireRole(eq(1L), eq("p1"), eq(Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER))))
                .thenThrow(new BizException("PROJECT-404", "not found"));

        BizException ex = assertThrows(BizException.class, () -> controller.subscribe("p1", "kb-1", null));
        assertEquals("PROJECT-404", ex.getCode());
    }

    @Test
    @DisplayName("subscribe: kbId 缺失应返回 KB-400，且不注册连接")
    void subscribe_whenKbIdMissing_shouldThrowKb400() {
        when(authzSdk.requireUserId()).thenReturn(1L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");

        BizException ex = assertThrows(BizException.class, () -> controller.subscribe("p1", " ", null));
        assertEquals("KB-400", ex.getCode());
        verifyNoInteractions(tenantPushRegistry);
    }
}
