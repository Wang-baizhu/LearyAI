// Responsibility: Verify PermissionSupport project/member/owner guard behavior.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PermissionSupportTest {
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;

    @InjectMocks
    private PermissionSupport permissionSupport;

    @AfterEach
    void clearContext() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("requireUserId: 未登录应返回 UNAUTHORIZED")
    void requireUserId_whenNoLogin_shouldThrowUnauthorized() {
        BizException ex = assertThrows(BizException.class, permissionSupport::requireUserId);
        assertEquals("UNAUTHORIZED", ex.getCode());
    }

    @Test
    @DisplayName("requireUserId: 已登录应返回当前 userId")
    void requireUserId_whenLogin_shouldReturnUserId() {
        CurrentUserContext.setUserId(123L);
        assertEquals(123L, permissionSupport.requireUserId());
    }

    @Test
    @DisplayName("requireProjectId: 非 UUID 应返回 invalidCode")
    void requireProjectId_whenInvalidUuid_shouldThrowInvalidCode() {
        BizException ex = assertThrows(BizException.class,
                () -> permissionSupport.requireProjectId("bad-id", "P-REQ", "P-INV", "P-404"));
        assertEquals("P-INV", ex.getCode());
    }

    @Test
    @DisplayName("requireProjectId: 为空应返回 requiredCode")
    void requireProjectId_whenBlank_shouldThrowRequiredCode() {
        BizException ex = assertThrows(BizException.class,
                () -> permissionSupport.requireProjectId("   ", "P-REQ", "P-INV", "P-404"));
        assertEquals("P-REQ", ex.getCode());
    }

    @Test
    @DisplayName("requireProjectId: 项目不存在应返回 notFoundCode")
    void requireProjectId_whenProjectNotExists_shouldThrowNotFoundCode() {
        String projectId = "550e8400-e29b-41d4-a716-446655440000";
        when(projectRepository.existsById(projectId)).thenReturn(false);

        BizException ex = assertThrows(BizException.class,
                () -> permissionSupport.requireProjectId(projectId, "P-REQ", "P-INV", "P-404"));
        assertEquals("P-404", ex.getCode());
    }

    @Test
    @DisplayName("requireProjectId: 合法且存在应返回 trim 后 projectId")
    void requireProjectId_whenValidAndExists_shouldReturnNormalizedId() {
        String projectId = "550e8400-e29b-41d4-a716-446655440000";
        when(projectRepository.existsById(projectId)).thenReturn(true);

        String actual = permissionSupport.requireProjectId("  " + projectId + "  ", "P-REQ", "P-INV", "P-404");
        assertEquals(projectId, actual);
    }

    @Test
    @DisplayName("requireMemberRole: 有成员角色时应原样返回")
    void requireMemberRole_whenRoleExists_shouldReturnRole() {
        when(projectMemberRepository.findActiveRole("p1", 1L)).thenReturn(Optional.of(ProjectMemberRole.ADMIN));
        assertEquals(ProjectMemberRole.ADMIN,
                permissionSupport.requireMemberRole("p1", 1L, "M-403", "not member"));
    }

    @Test
    @DisplayName("requireOwnerRole: 非 OWNER 应返回 ownerForbiddenCode")
    void requireOwnerRole_whenNotOwner_shouldThrowOwnerForbiddenCode() {
        when(projectMemberRepository.findActiveRole("p1", 1L)).thenReturn(Optional.of(ProjectMemberRole.ADMIN));

        BizException ex = assertThrows(BizException.class,
                () -> permissionSupport.requireOwnerRole("p1", 1L,
                        "M-403", "not member", "O-403", "not owner"));
        assertEquals("O-403", ex.getCode());
    }

    @Test
    @DisplayName("requireOwnerRole: 非成员应返回 memberForbiddenCode")
    void requireOwnerRole_whenNotMember_shouldThrowMemberForbiddenCode() {
        when(projectMemberRepository.findActiveRole("p1", 1L)).thenReturn(Optional.empty());

        BizException ex = assertThrows(BizException.class,
                () -> permissionSupport.requireOwnerRole("p1", 1L,
                        "M-403", "not member", "O-403", "not owner"));
        assertEquals("M-403", ex.getCode());
    }

    @Test
    @DisplayName("requireOwnerRole: OWNER 应通过")
    void requireOwnerRole_whenOwner_shouldPass() {
        when(projectMemberRepository.findActiveRole("p1", 1L)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        assertDoesNotThrow(() -> permissionSupport.requireOwnerRole("p1", 1L,
                "M-403", "not member", "O-403", "not owner"));
    }

    @Test
    @DisplayName("isMember: 存在角色时应返回 true")
    void isMember_whenRoleExists_shouldReturnTrue() {
        when(projectMemberRepository.findActiveRole("p1", 1L)).thenReturn(Optional.of(ProjectMemberRole.MEMBER));
        assertTrue(permissionSupport.isMember("p1", 1L));
    }

    @Test
    @DisplayName("isMember: 不存在角色时应返回 false")
    void isMember_whenRoleMissing_shouldReturnFalse() {
        when(projectMemberRepository.findActiveRole("p1", 1L)).thenReturn(Optional.empty());
        assertFalse(permissionSupport.isMember("p1", 1L));
    }

    @Test
    @DisplayName("requireMemberRole: 非成员时应返回 forbiddenCode")
    void requireMemberRole_whenNoRole_shouldThrowForbiddenCode() {
        when(projectMemberRepository.findActiveRole("p1", 1L)).thenReturn(Optional.empty());

        BizException ex = assertThrows(BizException.class,
                () -> permissionSupport.requireMemberRole("p1", 1L, "M-403", "not member"));

        assertEquals("M-403", ex.getCode());
    }
}
