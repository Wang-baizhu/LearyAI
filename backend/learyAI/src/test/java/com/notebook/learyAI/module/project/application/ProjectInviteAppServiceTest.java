// Responsibility: Verify ProjectInviteAppService core invite lifecycle branches.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzCacheEvictor;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectInvite;
import com.notebook.learyAI.module.project.domain.model.ProjectInviteStatus;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectInviteRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjectInviteAppServiceTest {
    private static final String PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";

    @Mock
    private ProjectInviteRepository inviteRepository;
    @Mock
    private ProjectRepository projectRepository;
    @Mock
    private ProjectMemberRepository projectMemberRepository;
    @Mock
    private AuthzCacheEvictor authzCacheEvictor;

    @InjectMocks
    private ProjectInviteAppService projectInviteAppService;

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("acceptInvite 过期邀请码应标记 EXPIRED 并返回 PROJECT-400")
    void acceptInvite_expired_shouldMarkExpiredAndThrow() {
        CurrentUserContext.setUserId(1L);
        ProjectInvite expiredInvite = new ProjectInvite(
                1L, PROJECT_ID, "code-1", 2L, 1, 0, ProjectInviteStatus.ACTIVE,
                Instant.now().minusSeconds(60), Instant.now().minusSeconds(3600), Instant.now().minusSeconds(3600));
        when(inviteRepository.findByCode("code-1")).thenReturn(Optional.of(expiredInvite));

        BizException ex = assertThrows(BizException.class, () -> projectInviteAppService.acceptInvite("code-1"));

        assertEquals("PROJECT-400", ex.getCode());
        ArgumentCaptor<ProjectInvite> captor = ArgumentCaptor.forClass(ProjectInvite.class);
        verify(inviteRepository).save(captor.capture());
        assertEquals(ProjectInviteStatus.EXPIRED, captor.getValue().getStatus());
    }

    @Test
    @DisplayName("acceptInvite 已是 ACTIVE 成员时应直接返回项目摘要且不重复写成员")
    void acceptInvite_existingActiveMember_shouldReturnSummaryWithoutMutation() {
        CurrentUserContext.setUserId(1L);
        Instant now = Instant.now();
        ProjectInvite invite = new ProjectInvite(
                1L, PROJECT_ID, "code-2", 2L, 3, 1, ProjectInviteStatus.ACTIVE,
                now.plusSeconds(3600), now, now);
        ProjectMember existing = new ProjectMember(
                10L, PROJECT_ID, 1L, ProjectMemberRole.ADMIN, ProjectMemberStatus.ACTIVE, now.minusSeconds(60), now);
        Project project = new Project(PROJECT_ID, "p-name", 2L, now.minusSeconds(300), now.minusSeconds(100));
        when(inviteRepository.findByCode("code-2")).thenReturn(Optional.of(invite));
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 1L)).thenReturn(Optional.of(existing));
        when(projectRepository.findById(PROJECT_ID)).thenReturn(Optional.of(project));

        ProjectAppService.ProjectMemberSummary summary = projectInviteAppService.acceptInvite("code-2");

        assertEquals(PROJECT_ID, summary.getProjectId());
        assertEquals(ProjectMemberRole.ADMIN, summary.getRole());
        verify(projectMemberRepository, never()).save(any());
        verify(inviteRepository, never()).save(any());
        verify(authzCacheEvictor, never()).evictRole(any(), any(Long.class));
    }

    @Test
    @DisplayName("revokeInvite 已撤销邀请码应幂等返回")
    void revokeInvite_alreadyRevoked_shouldBeIdempotent() {
        CurrentUserContext.setUserId(1L);
        ProjectInvite revoked = new ProjectInvite(
                9L, PROJECT_ID, "code-3", 1L, 1, 0, ProjectInviteStatus.REVOKED,
                null, Instant.now().minusSeconds(60), Instant.now().minusSeconds(60));
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(projectMemberRepository.findActiveRole(PROJECT_ID, 1L)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(inviteRepository.findById(9L)).thenReturn(Optional.of(revoked));

        projectInviteAppService.revokeInvite(PROJECT_ID, 9L);

        verify(inviteRepository, never()).save(any());
    }

    @Test
    @DisplayName("createInvite owner 创建成功时应落库并返回摘要")
    void createInvite_success_shouldPersistAndReturnSummary() {
        CurrentUserContext.setUserId(1L);
        Instant now = Instant.now();
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(projectMemberRepository.findActiveRole(PROJECT_ID, 1L)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(inviteRepository.findByCode(any())).thenReturn(Optional.empty());
        when(inviteRepository.save(any(ProjectInvite.class))).thenAnswer(invocation -> {
            ProjectInvite raw = invocation.getArgument(0);
            return new ProjectInvite(11L, raw.getProjectId(), raw.getCode(), raw.getCreatorId(), raw.getMaxUse(),
                    raw.getUsedCount(), raw.getStatus(), raw.getExpiresAt(), raw.getCreatedAt(), raw.getUpdatedAt());
        });

        ProjectInviteAppService.ProjectInviteSummary summary =
                projectInviteAppService.createInvite(PROJECT_ID, 2, now.plusSeconds(3600));

        assertEquals(11L, summary.getId());
        assertNotNull(summary.getCode());
        assertEquals(2, summary.getMaxUse());
        assertEquals(ProjectInviteStatus.ACTIVE, summary.getStatus());
    }

    @Test
    @DisplayName("acceptInvite 邀请状态非 ACTIVE 时应返回 PROJECT-400")
    void acceptInvite_inactiveInvite_shouldThrowProject400() {
        CurrentUserContext.setUserId(1L);
        ProjectInvite inactive = new ProjectInvite(
                1L, PROJECT_ID, "code-x", 2L, 1, 0, ProjectInviteStatus.REVOKED,
                Instant.now().plusSeconds(3600), Instant.now().minusSeconds(60), Instant.now().minusSeconds(60));
        when(inviteRepository.findByCode("code-x")).thenReturn(Optional.of(inactive));

        BizException ex = assertThrows(BizException.class, () -> projectInviteAppService.acceptInvite("code-x"));

        assertEquals("PROJECT-400", ex.getCode());
    }

    @Test
    @DisplayName("acceptInvite 使用次数超限时应返回 PROJECT-400")
    void acceptInvite_exceedMaxUse_shouldThrowProject400() {
        CurrentUserContext.setUserId(1L);
        Instant now = Instant.now();
        ProjectInvite full = new ProjectInvite(
                2L, PROJECT_ID, "code-full", 2L, 1, 1, ProjectInviteStatus.ACTIVE,
                now.plusSeconds(3600), now.minusSeconds(60), now.minusSeconds(60));
        when(inviteRepository.findByCode("code-full")).thenReturn(Optional.of(full));

        BizException ex = assertThrows(BizException.class, () -> projectInviteAppService.acceptInvite("code-full"));

        assertEquals("PROJECT-400", ex.getCode());
    }

    @Test
    @DisplayName("acceptInvite 首次入会应创建成员、递增邀请使用次数并驱逐 role 缓存")
    void acceptInvite_firstJoin_shouldSaveMemberAndInviteUsage() {
        CurrentUserContext.setUserId(9L);
        Instant now = Instant.now();
        ProjectInvite invite = new ProjectInvite(
                3L, PROJECT_ID, "code-join", 2L, 2, 0, ProjectInviteStatus.ACTIVE,
                now.plusSeconds(3600), now.minusSeconds(120), now.minusSeconds(120));
        when(inviteRepository.findByCode("code-join")).thenReturn(Optional.of(invite));
        when(projectMemberRepository.findByProjectIdAndUserId(PROJECT_ID, 9L)).thenReturn(Optional.empty());
        when(projectRepository.findById(PROJECT_ID)).thenReturn(Optional.of(
                new Project(PROJECT_ID, "p-name", 2L, now.minusSeconds(300), now.minusSeconds(50))
        ));

        ProjectAppService.ProjectMemberSummary summary = projectInviteAppService.acceptInvite("code-join");

        assertEquals(PROJECT_ID, summary.getProjectId());
        assertEquals(ProjectMemberRole.MEMBER, summary.getRole());
        verify(projectMemberRepository).save(any(ProjectMember.class));
        verify(authzCacheEvictor).evictRole(PROJECT_ID, 9L);
        ArgumentCaptor<ProjectInvite> inviteCaptor = ArgumentCaptor.forClass(ProjectInvite.class);
        verify(inviteRepository).save(inviteCaptor.capture());
        assertEquals(1, inviteCaptor.getValue().getUsedCount());
    }

    @Test
    @DisplayName("revokeInvite 邀请不属于项目时应返回 PROJECT-404")
    void revokeInvite_crossProject_shouldThrowNotFound() {
        CurrentUserContext.setUserId(1L);
        when(projectRepository.existsById(PROJECT_ID)).thenReturn(true);
        when(projectMemberRepository.findActiveRole(PROJECT_ID, 1L)).thenReturn(Optional.of(ProjectMemberRole.OWNER));
        when(inviteRepository.findById(9L)).thenReturn(Optional.of(
                new ProjectInvite(9L, "550e8400-e29b-41d4-a716-446655440001", "code-9", 1L, 1, 0,
                        ProjectInviteStatus.ACTIVE, null, Instant.now(), Instant.now())
        ));

        BizException ex = assertThrows(BizException.class,
                () -> projectInviteAppService.revokeInvite(PROJECT_ID, 9L));

        assertEquals("PROJECT-404", ex.getCode());
    }
}
