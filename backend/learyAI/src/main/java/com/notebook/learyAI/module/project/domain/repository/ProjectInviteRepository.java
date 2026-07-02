// Responsibility: Project invite repository abstraction.
package com.notebook.learyAI.module.project.domain.repository;

import com.notebook.learyAI.module.project.domain.model.ProjectInvite;

import java.util.List;
import java.util.Optional;

public interface ProjectInviteRepository {
    ProjectInvite save(ProjectInvite invite);

    Optional<ProjectInvite> findById(Long id);

    Optional<ProjectInvite> findByCode(String code);

    List<ProjectInvite> findByProjectId(String projectId);

    void deleteByProjectId(String projectId);
}
