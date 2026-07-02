// Responsibility: Centralize project-related permission checks for reuse across modules.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class PermissionSupport {
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public PermissionSupport(ProjectRepository projectRepository,
                             ProjectMemberRepository projectMemberRepository) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    public Long requireUserId() {
        Long current = CurrentUserContext.getUserId();
        if (current == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        return current;
    }

    public String requireProjectId(String projectId,
                                   String requiredCode,
                                   String invalidCode,
                                   String notFoundCode) {
        if (projectId == null || projectId.isBlank()) {
            throw new BizException(requiredCode, "projectId required");
        }
        String normalized = projectId.trim();
        try {
            UUID.fromString(normalized);
        } catch (IllegalArgumentException ex) {
            throw new BizException(invalidCode, "projectId invalid");
        }
        if (!projectRepository.existsById(normalized)) {
            throw new BizException(notFoundCode, "project not found");
        }
        return normalized;
    }

    public ProjectMemberRole requireMemberRole(String projectId,
                                               Long userId,
                                               String forbiddenCode,
                                               String forbiddenMessage) {
        return projectMemberRepository.findActiveRole(projectId, userId)
                .orElseThrow(() -> new BizException(forbiddenCode, forbiddenMessage));
    }

    public void requireOwnerRole(String projectId,
                                 Long userId,
                                 String memberForbiddenCode,
                                 String memberForbiddenMessage,
                                 String ownerForbiddenCode,
                                 String ownerForbiddenMessage) {
        ProjectMemberRole role = requireMemberRole(projectId, userId, memberForbiddenCode, memberForbiddenMessage);
        if (role != ProjectMemberRole.OWNER) {
            throw new BizException(ownerForbiddenCode, ownerForbiddenMessage);
        }
    }

    public boolean isMember(String projectId, Long userId) {
        return projectMemberRepository.findActiveRole(projectId, userId).isPresent();
    }
}
