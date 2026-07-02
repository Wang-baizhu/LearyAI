// Responsibility: Verify ProjectAppService main project lifecycle and membership flows.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.auth.domain.model.UserStatus;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzCacheEvictor;
import com.notebook.learyAI.module.kb.application.KnowledgeBaseAppService;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectInviteRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.module.visit.application.UserResourceVisitAppService;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectAppServiceTest {
    private static final String PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";

    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private ProjectInviteRepository projectInviteRepository;
    @Mock
    private UserResourceVisitAppService visitAppService;
    @Mock
    private UserRepository userRepository;
    @Mock
    private PermissionSupport permissionSupport;
    @Mock
    private KnowledgeBaseAppService knowledgeBaseAppService;
    @Mock
    private AuthzCacheEvictor authzCacheEvictor;

    @InjectMocks
    private ProjectAppService projectAppService;

    @Test
    @DisplayName("createProject 应创建项目与 owner 成员并记录访问")
    void createProject_shouldPersistProjectAndOwnerMember() {
        when(permissionSupport.requireUserId()).thenReturn(11L);

        ProjectAppService.ProjectMemberSummary summary = projectAppService.createProject("  我的项目  ");

        assertEquals("我的项目", summary.getName());
        assertEquals(ProjectMemberRole.OWNER, summary.getRole());
        verify(projectRepository).save(any(Project.class));
        verify(projectMemberRepository).save(any(ProjectMember.class));
        verify(authzCacheEvictor).evictProjectExists(summary.getProjectId());
        verify(authzCacheEvictor).evictRole(summary.getProjectId(), 11L);
        verify(visitAppService).recordVisit(eq(11L), eq(UserResourceType.PROJECT), eq(summary.getProjectId()), any());
    }

    @Test
    @DisplayName("listProjects 应返回用户可见项目分页")
    void listProjects_shouldReturnPagedSummaries() {
        when(permissionSupport.requireUserId()).thenReturn(7L);
        Instant older = Instant.parse("2024-01-01T00:00:00Z");
        Instant newer = Instant.parse("2024-02-01T00:00:00Z");
        when(projectMemberRepository.findByUserId(7L)).thenReturn(List.of(
                new ProjectMember(1L, PROJECT_ID, 7L, ProjectMemberRole.OWNER, ProjectMemberStatus.ACTIVE, newer, newer),
                new ProjectMember(2L, "550e8400-e29b-41d4-a716-446655440001", 7L, ProjectMemberRole.ADMIN,
                        ProjectMemberStatus.ACTIVE, older, older)
        ));
        when(projectRepository.findByIds(List.of(PROJECT_ID, "550e8400-e29b-41d4-a716-446655440001")))
                .thenReturn(List.of(
                        new Project(PROJECT_ID, "P1", 7L, newer, newer),
                        new Project("550e8400-e29b-41d4-a716-446655440001", "P2", 1L, older, older)
                ));

        ProjectAppService.ProjectMemberPage page = projectAppService.listProjects(1, 10);

        assertEquals(2, page.getItems().size());
        assertEquals(PROJECT_ID, page.getItems().get(0).getProjectId());
        assertEquals(2, page.getTotal());
    }

    @Test
    @DisplayName("changeMemberRole 角色变化时应落库并清理 authz 缓存")
    void changeMemberRole_shouldSaveAndEvictRoleCache() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        ProjectMember target = new ProjectMember(3L, PROJECT_ID, 2L, ProjectMemberRole.MEMBER,
                ProjectMemberStatus.ACTIVE, Instant.now().minusSeconds(10), Instant.now().minusSeconds(10));
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 2L)).thenReturn(Optional.of(target));

        projectAppService.changeMemberRole(PROJECT_ID, 2L, ProjectMemberRole.ADMIN);

        ArgumentCaptor<ProjectMember> captor = ArgumentCaptor.forClass(ProjectMember.class);
        verify(projectMemberRepository).save(captor.capture());
        assertEquals(ProjectMemberRole.ADMIN, captor.getValue().getRole());
        verify(authzCacheEvictor).evictRole(PROJECT_ID, 2L);
    }

    @Test
    @DisplayName("removeMember owner 删除他人时应删除成员并清理缓存")
    void removeMember_shouldDeleteAndEvict() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);

        projectAppService.removeMember(PROJECT_ID, 2L);

        verify(projectMemberRepository).deleteByProjectIdAndUserId(PROJECT_ID, 2L);
        verify(authzCacheEvictor).evictRole(PROJECT_ID, 2L);
    }

    @Test
    @DisplayName("leaveProject 非 owner 离开应删除成员并清理缓存")
    void leaveProject_member_shouldDeleteAndEvict() {
        when(permissionSupport.requireUserId()).thenReturn(2L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        when(permissionSupport.requireMemberRole(PROJECT_ID, 2L, "PROJECT-403", "project access denied"))
                .thenReturn(ProjectMemberRole.ADMIN);

        projectAppService.leaveProject(PROJECT_ID);

        verify(projectMemberRepository).deleteByProjectIdAndUserId(PROJECT_ID, 2L);
        verify(authzCacheEvictor).evictRole(PROJECT_ID, 2L);
    }

    @Test
    @DisplayName("leaveProject owner 离开应拒绝")
    void leaveProject_owner_shouldThrow() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        when(permissionSupport.requireMemberRole(PROJECT_ID, 1L, "PROJECT-403", "project access denied"))
                .thenReturn(ProjectMemberRole.OWNER);

        BizException ex = assertThrows(BizException.class, () -> projectAppService.leaveProject(PROJECT_ID));

        assertEquals("PROJECT-400", ex.getCode());
        verify(projectMemberRepository, never()).deleteByProjectIdAndUserId(any(), any());
    }

    @Test
    @DisplayName("renameProject 应更新名称并返回摘要")
    void renameProject_shouldUpdateProjectName() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        Project existing = new Project(PROJECT_ID, "old", 1L, Instant.now().minusSeconds(60), Instant.now());
        when(projectRepository.findById(PROJECT_ID)).thenReturn(Optional.of(existing));

        ProjectAppService.ProjectMemberSummary result = projectAppService.renameProject(PROJECT_ID, "  new-name ");

        assertEquals("new-name", result.getName());
        verify(projectRepository).save(any(Project.class));
    }

    @Test
    @DisplayName("deleteProject 应删除关联数据并驱逐 project 缓存")
    void deleteProject_shouldDeleteRelatedData() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);

        projectAppService.deleteProject(PROJECT_ID);

        verify(visitAppService).deleteByResource(UserResourceType.PROJECT, PROJECT_ID);
        verify(knowledgeBaseAppService).deleteByProject(PROJECT_ID);
        verify(projectInviteRepository).deleteByProjectId(PROJECT_ID);
        verify(projectMemberRepository).deleteByProjectId(PROJECT_ID);
        verify(projectRepository).deleteById(PROJECT_ID);
        verify(authzCacheEvictor).evictProjectExists(PROJECT_ID);
        verify(authzCacheEvictor).evictProjectRoles(PROJECT_ID);
    }

    @Test
    @DisplayName("listMembers 应回填用户名称并分页返回")
    void listMembers_shouldBuildMemberDetails() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        when(permissionSupport.requireMemberRole(PROJECT_ID, 1L, "PROJECT-403", "project access denied"))
                .thenReturn(ProjectMemberRole.ADMIN);
        Instant now = Instant.now();
        when(projectMemberRepository.findByProjectId(PROJECT_ID)).thenReturn(List.of(
                new ProjectMember(1L, PROJECT_ID, 9L, ProjectMemberRole.MEMBER, ProjectMemberStatus.ACTIVE, now, now)
        ));
        when(userRepository.findByIds(List.of(9L))).thenReturn(List.of(
                new User(9L, "u9", "u9@test.com", "13800000000", "hash", UserStatus.ACTIVE, UserMode.FREE,
                        now.minusSeconds(100), now.minusSeconds(50))
        ));

        ProjectAppService.ProjectMemberDetailPage page = projectAppService.listMembers(PROJECT_ID, 1, 10);

        assertEquals(1, page.getItems().size());
        assertEquals("u9", page.getItems().get(0).getName());
        assertEquals(9L, page.getItems().get(0).getUserId());
    }

    @Test
    @DisplayName("transferOwner 成功时应更新项目 owner 与双方角色并清理角色缓存")
    void transferOwner_success_shouldUpdateOwnerAndRoles() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        Instant now = Instant.now();
        ProjectMember target = new ProjectMember(10L, PROJECT_ID, 2L, ProjectMemberRole.ADMIN,
                ProjectMemberStatus.ACTIVE, now.minusSeconds(200), now.minusSeconds(100));
        ProjectMember owner = new ProjectMember(11L, PROJECT_ID, 1L, ProjectMemberRole.OWNER,
                ProjectMemberStatus.ACTIVE, now.minusSeconds(400), now.minusSeconds(300));
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 2L)).thenReturn(Optional.of(target));
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 1L)).thenReturn(Optional.of(owner));
        when(projectRepository.findById(PROJECT_ID)).thenReturn(Optional.of(
                new Project(PROJECT_ID, "p", 1L, now.minusSeconds(500), now.minusSeconds(300))
        ));

        projectAppService.transferOwner(PROJECT_ID, 2L);

        ArgumentCaptor<Project> projectCaptor = ArgumentCaptor.forClass(Project.class);
        verify(projectRepository).save(projectCaptor.capture());
        assertEquals(2L, projectCaptor.getValue().getOwnerId());
        verify(projectMemberRepository, times(2)).save(any(ProjectMember.class));
        verify(authzCacheEvictor).evictRoles(PROJECT_ID, List.of(2L, 1L));
    }

    @Test
    @DisplayName("transferOwner 目标成员不存在时应返回 PROJECT-404")
    void transferOwner_targetMissing_shouldThrowNotFound() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 2L)).thenReturn(Optional.empty());

        BizException ex = assertThrows(BizException.class, () -> projectAppService.transferOwner(PROJECT_ID, 2L));

        assertEquals("PROJECT-404", ex.getCode());
    }

    @Test
    @DisplayName("transferOwner 目标成员非 ACTIVE 时应返回 PROJECT-400")
    void transferOwner_inactiveTarget_shouldThrowBadRequest() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 2L)).thenReturn(Optional.of(
                new ProjectMember(10L, PROJECT_ID, 2L, ProjectMemberRole.ADMIN, ProjectMemberStatus.DISABLED,
                        Instant.now().minusSeconds(50), Instant.now().minusSeconds(20))
        ));

        BizException ex = assertThrows(BizException.class, () -> projectAppService.transferOwner(PROJECT_ID, 2L));

        assertEquals("PROJECT-400", ex.getCode());
    }

    @Test
    @DisplayName("transferOwner 转让给自己时应返回 PROJECT-400")
    void transferOwner_self_shouldThrowBadRequest() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);

        BizException ex = assertThrows(BizException.class, () -> projectAppService.transferOwner(PROJECT_ID, 1L));

        assertEquals("PROJECT-400", ex.getCode());
    }

    @Test
    @DisplayName("changeMemberRole 角色未变化时应幂等返回")
    void changeMemberRole_sameRole_shouldBeIdempotent() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 2L)).thenReturn(Optional.of(
                new ProjectMember(3L, PROJECT_ID, 2L, ProjectMemberRole.ADMIN, ProjectMemberStatus.ACTIVE,
                        Instant.now().minusSeconds(10), Instant.now().minusSeconds(5))
        ));

        projectAppService.changeMemberRole(PROJECT_ID, 2L, ProjectMemberRole.ADMIN);

        verify(projectMemberRepository, never()).save(any(ProjectMember.class));
        verify(authzCacheEvictor, never()).evictRole(any(), any());
    }

    @Test
    @DisplayName("changeMemberRole 目标角色为空时应返回 PROJECT-400")
    void changeMemberRole_nullRole_shouldThrowBadRequest() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);

        BizException ex = assertThrows(BizException.class,
                () -> projectAppService.changeMemberRole(PROJECT_ID, 2L, null));

        assertEquals("PROJECT-400", ex.getCode());
        verify(projectMemberRepository, never()).findByProjectIdAndUserId(any(), any());
    }

    @Test
    @DisplayName("changeMemberRole 目标角色为 OWNER 时应返回 PROJECT-400")
    void changeMemberRole_ownerRole_shouldThrowBadRequest() {
        when(permissionSupport.requireUserId()).thenReturn(1L);
        when(permissionSupport.requireProjectId(PROJECT_ID, "PROJECT-400", "PROJECT-400", "PROJECT-404"))
                .thenReturn(PROJECT_ID);

        BizException ex = assertThrows(BizException.class,
                () -> projectAppService.changeMemberRole(PROJECT_ID, 2L, ProjectMemberRole.OWNER));

        assertEquals("PROJECT-400", ex.getCode());
        verify(projectMemberRepository, never()).findByProjectIdAndUserId(any(), any());
    }

    @Test
    @DisplayName("listProjects 参数非法时应返回 PROJECT-400")
    void listProjects_invalidPageSize_shouldThrowBadRequest() {
        BizException ex = assertThrows(BizException.class, () -> projectAppService.listProjects(0, 200));
        assertEquals("PROJECT-400", ex.getCode());
    }

    @Test
    @DisplayName("listMembers 参数非法时应返回 PROJECT-400")
    void listMembers_invalidPageSize_shouldThrowBadRequest() {
        BizException ex = assertThrows(BizException.class, () -> projectAppService.listMembers(PROJECT_ID, 0, 101));
        assertEquals("PROJECT-400", ex.getCode());
    }
}
