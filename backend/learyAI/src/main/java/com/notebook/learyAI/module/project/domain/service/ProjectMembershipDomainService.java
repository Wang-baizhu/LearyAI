// Responsibility: Encapsulate reusable project membership rules and member state transitions.
package com.notebook.learyAI.module.project.domain.service;

import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.shared.exception.BizException;

import java.time.Instant;

public final class ProjectMembershipDomainService {
    public void requireOwnerRole(ProjectMemberRole role, String code, String message) {
        if (role != ProjectMemberRole.OWNER) {
            throw new BizException(code, message);
        }
    }

    public void requireNotOwner(ProjectMemberRole role, String code, String message) {
        if (role == ProjectMemberRole.OWNER) {
            throw new BizException(code, message);
        }
    }

    public void requireNotSelf(Long actorUserId, Long targetUserId, String code, String message) {
        if (actorUserId != null && actorUserId.equals(targetUserId)) {
            throw new BizException(code, message);
        }
    }

    public ProjectMemberRole resolveAssignableRole(ProjectMemberRole role,
                                                   String requiredCode,
                                                   String requiredMessage,
                                                   String ownerCode,
                                                   String ownerMessage) {
        if (role == null) {
            throw new BizException(requiredCode, requiredMessage);
        }
        if (role == ProjectMemberRole.OWNER) {
            throw new BizException(ownerCode, ownerMessage);
        }
        return role;
    }

    public void requireActiveMember(ProjectMember member, String code, String message) {
        if (member.getStatus() != ProjectMemberStatus.ACTIVE) {
            throw new BizException(code, message);
        }
    }

    public Project transferOwnership(Project project, Long targetUserId, Instant now) {
        return new Project(project.getId(), project.getName(), targetUserId, project.getCreatedAt(), now);
    }

    public ProjectMember updateRole(ProjectMember member, ProjectMemberRole role, Instant now) {
        return new ProjectMember(member.getId(), member.getProjectId(), member.getUserId(), role,
                member.getStatus(), member.getCreatedAt(), now);
    }
}
