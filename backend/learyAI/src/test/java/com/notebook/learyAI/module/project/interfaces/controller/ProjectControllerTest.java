// Responsibility: Verify ProjectController HTTP contract, validation, and delegation.
package com.notebook.learyAI.module.project.interfaces.controller;

import com.notebook.learyAI.module.project.application.ProjectAppService;
import com.notebook.learyAI.module.project.application.ProjectInviteAppService;
import com.notebook.learyAI.module.project.domain.model.ProjectInviteStatus;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.shared.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.validation.beanvalidation.LocalValidatorFactoryBean;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class ProjectControllerTest {
    private static final String PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";

    @Mock
    private ProjectAppService projectAppService;
    @Mock
    private ProjectInviteAppService inviteAppService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        ProjectController controller = new ProjectController(projectAppService, inviteAppService);
        LocalValidatorFactoryBean validator = new LocalValidatorFactoryBean();
        validator.afterPropertiesSet();
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .setValidator(validator)
                .build();
    }

    @Test
    @DisplayName("POST /api/projects: 参数非法返回 VALIDATION_ERROR")
    void create_invalidRequest_shouldReturnValidationError() throws Exception {
        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        verifyNoInteractions(projectAppService);
    }

    @Test
    @DisplayName("POST /api/projects: 创建成功返回 201 与项目摘要")
    void create_success_shouldReturnCreated() throws Exception {
        Instant now = Instant.parse("2026-03-01T00:00:00Z");
        when(projectAppService.createProject("空间A")).thenReturn(
                new ProjectAppService.ProjectMemberSummary(PROJECT_ID, "空间A", ProjectMemberRole.OWNER, now, now)
        );

        mockMvc.perform(post("/api/projects")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"空间A\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.projectId").value(PROJECT_ID))
                .andExpect(jsonPath("$.data.role").value("OWNER"));
    }

    @Test
    @DisplayName("GET /api/projects: 返回分页列表契约")
    void list_shouldReturnPagedResponse() throws Exception {
        Instant now = Instant.parse("2026-03-01T00:00:00Z");
        when(projectAppService.listProjects(1, 20)).thenReturn(
                new ProjectAppService.ProjectMemberPage(List.of(
                        new ProjectAppService.ProjectMemberSummary(PROJECT_ID, "空间A", ProjectMemberRole.ADMIN, now, now)
                ), 1, 1, 20)
        );

        mockMvc.perform(get("/api/projects").param("page", "1").param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.total").value(1))
                .andExpect(jsonPath("$.data.items[0].projectId").value(PROJECT_ID))
                .andExpect(jsonPath("$.data.items[0].role").value("ADMIN"));
    }

    @Test
    @DisplayName("PATCH /api/projects/{projectId}/members/{userId}/role: role 为空返回 VALIDATION_ERROR")
    void changeMemberRole_nullRole_shouldReturnValidationError() throws Exception {
        mockMvc.perform(patch("/api/projects/{projectId}/members/{userId}/role", PROJECT_ID, 2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("PATCH /api/projects/{projectId}/members/{userId}/role: 成功返回 204")
    void changeMemberRole_success_shouldReturnNoContent() throws Exception {
        mockMvc.perform(patch("/api/projects/{projectId}/members/{userId}/role", PROJECT_ID, 2)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"role\":\"ADMIN\"}"))
                .andExpect(status().isNoContent());
        verify(projectAppService).changeMemberRole(PROJECT_ID, 2L, ProjectMemberRole.ADMIN);
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/invites: maxUse 非法返回 VALIDATION_ERROR")
    void createInvite_invalidMaxUse_shouldReturnValidationError() throws Exception {
        mockMvc.perform(post("/api/projects/{projectId}/invites", PROJECT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"maxUse\":0}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        verifyNoInteractions(inviteAppService);
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/invites: 成功返回邀请码字段")
    void createInvite_success_shouldReturnInviteSummary() throws Exception {
        Instant now = Instant.parse("2026-03-02T00:00:00Z");
        when(inviteAppService.createInvite(any(), any(), any())).thenReturn(
                new ProjectInviteAppService.ProjectInviteSummary(1L, "abc123", 9L, 2, 0,
                        ProjectInviteStatus.ACTIVE, now.plusSeconds(3600), now)
        );

        mockMvc.perform(post("/api/projects/{projectId}/invites", PROJECT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"maxUse\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.id").value(1))
                .andExpect(jsonPath("$.data.code").value("abc123"))
                .andExpect(jsonPath("$.data.status").value("ACTIVE"));
    }

    @Test
    @DisplayName("POST /api/projects/invites/accept: inviteCode 为空返回 VALIDATION_ERROR")
    void acceptInvite_invalidRequest_shouldReturnValidationError() throws Exception {
        mockMvc.perform(post("/api/projects/invites/accept")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"inviteCode\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        verifyNoInteractions(inviteAppService);
    }

    @Test
    @DisplayName("POST /api/projects/invites/accept: 成功返回项目摘要")
    void acceptInvite_success_shouldReturnProjectSummary() throws Exception {
        Instant now = Instant.parse("2026-03-01T00:00:00Z");
        when(inviteAppService.acceptInvite("abc123")).thenReturn(
                new ProjectAppService.ProjectMemberSummary(PROJECT_ID, "空间A", ProjectMemberRole.MEMBER, now, now)
        );

        mockMvc.perform(post("/api/projects/invites/accept")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"inviteCode\":\"abc123\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.projectId").value(PROJECT_ID))
                .andExpect(jsonPath("$.data.role").value("MEMBER"));
    }

    @Test
    @DisplayName("DELETE /api/projects/{projectId}/invites/{inviteId}: 成功返回 204")
    void revokeInvite_success_shouldReturnNoContent() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}/invites/{inviteId}", PROJECT_ID, 7))
                .andExpect(status().isNoContent());
        verify(inviteAppService).revokeInvite(PROJECT_ID, 7L);
    }

    @Test
    @DisplayName("GET /api/projects/{projectId}/members: 返回成员分页")
    void members_shouldReturnMemberPage() throws Exception {
        Instant now = Instant.parse("2026-03-01T00:00:00Z");
        when(projectAppService.listMembers(PROJECT_ID, 1, 20)).thenReturn(
                new ProjectAppService.ProjectMemberDetailPage(List.of(
                        new ProjectAppService.ProjectMemberDetail(8L, "u8", ProjectMemberRole.ADMIN,
                                ProjectMemberStatus.ACTIVE, now)
                ), 1, 1, 20)
        );

        mockMvc.perform(get("/api/projects/{projectId}/members", PROJECT_ID)
                        .param("page", "1")
                        .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.items[0].userId").value(8))
                .andExpect(jsonPath("$.data.items[0].role").value("ADMIN"));
    }

    @Test
    @DisplayName("DELETE /api/projects/{projectId}/members/{userId}: 成功返回 204")
    void removeMember_success_shouldReturnNoContent() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}/members/{userId}", PROJECT_ID, 8))
                .andExpect(status().isNoContent());
        verify(projectAppService).removeMember(PROJECT_ID, 8L);
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/leave: 成功返回 204")
    void leave_success_shouldReturnNoContent() throws Exception {
        mockMvc.perform(post("/api/projects/{projectId}/leave", PROJECT_ID))
                .andExpect(status().isNoContent());
        verify(projectAppService).leaveProject(PROJECT_ID);
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/transfer: targetUserId 为空返回 VALIDATION_ERROR")
    void transfer_invalidRequest_shouldReturnValidationError() throws Exception {
        mockMvc.perform(post("/api/projects/{projectId}/transfer", PROJECT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("POST /api/projects/{projectId}/transfer: 成功返回 204")
    void transfer_success_shouldReturnNoContent() throws Exception {
        mockMvc.perform(post("/api/projects/{projectId}/transfer", PROJECT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targetUserId\":9}"))
                .andExpect(status().isNoContent());
        verify(projectAppService).transferOwner(PROJECT_ID, 9L);
    }

    @Test
    @DisplayName("PATCH /api/projects/{projectId}: name 为空返回 VALIDATION_ERROR")
    void rename_invalidRequest_shouldReturnValidationError() throws Exception {
        mockMvc.perform(patch("/api/projects/{projectId}", PROJECT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    @DisplayName("PATCH /api/projects/{projectId}: 成功返回项目摘要")
    void rename_success_shouldReturnProjectSummary() throws Exception {
        Instant now = Instant.parse("2026-03-01T00:00:00Z");
        when(projectAppService.renameProject(PROJECT_ID, "新名称")).thenReturn(
                new ProjectAppService.ProjectMemberSummary(PROJECT_ID, "新名称", ProjectMemberRole.OWNER, now, now)
        );

        mockMvc.perform(patch("/api/projects/{projectId}", PROJECT_ID)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"新名称\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.name").value("新名称"));
    }

    @Test
    @DisplayName("DELETE /api/projects/{projectId}: 成功返回 204")
    void deleteProject_success_shouldReturnNoContent() throws Exception {
        mockMvc.perform(delete("/api/projects/{projectId}", PROJECT_ID))
                .andExpect(status().isNoContent());
        verify(projectAppService).deleteProject(PROJECT_ID);
    }
}
