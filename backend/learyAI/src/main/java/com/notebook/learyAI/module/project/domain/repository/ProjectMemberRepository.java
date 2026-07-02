// Responsibility: Project member repository abstraction.
package com.notebook.learyAI.module.project.domain.repository;

import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;

public interface ProjectMemberRepository {
    ProjectMember save(ProjectMember member);

    java.util.Optional<ProjectMemberRole> findActiveRole(String projectId, Long userId);

    java.util.List<ProjectMember> findByUserId(Long userId);

    java.util.List<ProjectMember> findByProjectId(String projectId);

    java.util.Optional<ProjectMember> findByProjectIdAndUserId(String projectId, Long userId);

    void deleteByProjectIdAndUserId(String projectId, Long userId);

    void deleteByProjectId(String projectId);
}
