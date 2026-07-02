// Responsibility: Expose project and invite endpoints.
package com.notebook.learyAI.module.project.interfaces.controller;

import com.notebook.learyAI.module.project.application.ProjectAppService;
import com.notebook.learyAI.module.project.application.ProjectInviteAppService;
import com.notebook.learyAI.module.project.application.ProjectInviteAppService.ProjectInviteSummary;
import com.notebook.learyAI.module.project.application.ProjectAppService.ProjectMemberDetail;
import com.notebook.learyAI.module.project.application.ProjectAppService.ProjectMemberDetailPage;
import com.notebook.learyAI.module.project.application.ProjectAppService.ProjectMemberPage;
import com.notebook.learyAI.module.project.application.ProjectAppService.ProjectMemberSummary;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectCreateRequest;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectInviteAcceptRequest;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectInviteCreateRequest;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectInviteCreateResponse;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectInviteResponse;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectListResponse;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectMemberRoleChangeRequest;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectMemberListResponse;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectMemberResponse;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectRenameRequest;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectResponse;
import com.notebook.learyAI.module.project.interfaces.dto.ProjectTransferRequest;
import com.notebook.learyAI.shared.api.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/projects")
public class ProjectController {
    private final ProjectAppService projectAppService;
    private final ProjectInviteAppService inviteAppService;

    public ProjectController(ProjectAppService projectAppService,
                             ProjectInviteAppService inviteAppService) {
        this.projectAppService = projectAppService;
        this.inviteAppService = inviteAppService;
    }

    @GetMapping
    public ApiResponse<ProjectListResponse> list(@RequestParam(required = false) Integer page,
                                                 @RequestParam(required = false) Integer size) {
        ProjectMemberPage result = projectAppService.listProjects(page, size);
        List<ProjectResponse> items = result.getItems().stream()
                .map(this::toProjectResponse)
                .collect(Collectors.toList());
        return ApiResponse.ok("项目列表查询成功",
                new ProjectListResponse(items, result.getTotal(), result.getPage(), result.getSize()));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ProjectResponse> create(@Valid @RequestBody ProjectCreateRequest request) {
        ProjectMemberSummary created = projectAppService.createProject(request.getName());
        return ApiResponse.ok("项目创建成功", toProjectResponse(created));
    }

    @GetMapping("/{projectId}/members")
    public ApiResponse<ProjectMemberListResponse> members(@PathVariable String projectId,
                                                          @RequestParam(required = false) Integer page,
                                                          @RequestParam(required = false) Integer size) {
        ProjectMemberDetailPage result = projectAppService.listMembers(projectId, page, size);
        List<ProjectMemberResponse> members = result.getItems().stream()
                .map(this::toMemberResponse)
                .collect(Collectors.toList());
        return ApiResponse.ok("项目成员列表查询成功",
                new ProjectMemberListResponse(members, result.getTotal(), result.getPage(), result.getSize()));
    }

    @DeleteMapping("/{projectId}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable String projectId, @PathVariable Long userId) {
        projectAppService.removeMember(projectId, userId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{projectId}/members/{userId}/role")
    public ResponseEntity<Void> changeMemberRole(@PathVariable String projectId,
                                                 @PathVariable Long userId,
                                                 @Valid @RequestBody ProjectMemberRoleChangeRequest request) {
        projectAppService.changeMemberRole(projectId, userId, request.getRole());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{projectId}/leave")
    public ResponseEntity<Void> leave(@PathVariable String projectId) {
        projectAppService.leaveProject(projectId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{projectId}/transfer")
    public ResponseEntity<Void> transfer(@PathVariable String projectId,
                                         @Valid @RequestBody ProjectTransferRequest request) {
        projectAppService.transferOwner(projectId, request.getTargetUserId());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{projectId}")
    public ResponseEntity<Void> delete(@PathVariable String projectId) {
        projectAppService.deleteProject(projectId);
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/{projectId}")
    public ApiResponse<ProjectResponse> rename(@PathVariable String projectId,
                                               @Valid @RequestBody ProjectRenameRequest request) {
        ProjectMemberSummary updated = projectAppService.renameProject(projectId, request.getName());
        return ApiResponse.ok("项目重命名成功", toProjectResponse(updated));
    }

    @PostMapping("/{projectId}/invites")
    public ApiResponse<ProjectInviteCreateResponse> createInvite(@PathVariable String projectId,
                                                                 @Valid @RequestBody ProjectInviteCreateRequest request) {
        ProjectInviteSummary summary = inviteAppService.createInvite(projectId, request.getMaxUse(),
                request.getExpiresAt());
        return ApiResponse.ok("项目邀请码创建成功",
                new ProjectInviteCreateResponse(summary.getId(), summary.getCode(),
                        summary.getStatus().name(), summary.getExpiresAt()));
    }

    @GetMapping("/{projectId}/invites")
    public ApiResponse<List<ProjectInviteResponse>> listInvites(@PathVariable String projectId) {
        List<ProjectInviteResponse> invites = inviteAppService.listInvites(projectId).stream()
                .map(this::toInviteResponse)
                .collect(Collectors.toList());
        return ApiResponse.ok("项目邀请码列表查询成功", invites);
    }

    @DeleteMapping("/{projectId}/invites/{inviteId}")
    public ResponseEntity<Void> revokeInvite(@PathVariable String projectId, @PathVariable Long inviteId) {
        inviteAppService.revokeInvite(projectId, inviteId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/invites/accept")
    public ApiResponse<ProjectResponse> acceptInvite(@Valid @RequestBody ProjectInviteAcceptRequest request) {
        ProjectMemberSummary summary = inviteAppService.acceptInvite(request.getInviteCode());
        return ApiResponse.ok("加入项目成功", toProjectResponse(summary));
    }

    private ProjectResponse toProjectResponse(ProjectMemberSummary summary) {
        return new ProjectResponse(summary.getProjectId(), summary.getName(), summary.getRole().name(),
                summary.getCreatedAt(), summary.getUpdatedAt());
    }

    private ProjectMemberResponse toMemberResponse(ProjectMemberDetail member) {
        return new ProjectMemberResponse(member.getUserId(), member.getName(), member.getRole().name(),
                member.getStatus().name(),
                member.getCreatedAt());
    }

    private ProjectInviteResponse toInviteResponse(ProjectInviteSummary summary) {
        return new ProjectInviteResponse(summary.getId(), summary.getCode(), summary.getCreatorId(),
                summary.getMaxUse(), summary.getUsedCount(), summary.getStatus().name(), summary.getExpiresAt(),
                summary.getCreatedAt());
    }
}
