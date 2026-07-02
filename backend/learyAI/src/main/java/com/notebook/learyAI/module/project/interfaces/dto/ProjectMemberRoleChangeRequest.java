// Responsibility: Project member role change request payload.
package com.notebook.learyAI.module.project.interfaces.dto;

import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import jakarta.validation.constraints.NotNull;

public class ProjectMemberRoleChangeRequest {
    @NotNull
    private ProjectMemberRole role;

    public ProjectMemberRole getRole() {
        return role;
    }

    public void setRole(ProjectMemberRole role) {
        this.role = role;
    }
}
