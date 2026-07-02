// Responsibility: Project repository abstraction.
package com.notebook.learyAI.module.project.domain.repository;

import com.notebook.learyAI.module.project.domain.model.Project;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository {
    Project save(Project project);

    Optional<Project> findById(String projectId);

    boolean existsById(String projectId);

    List<Project> findByIds(List<String> projectIds);

    Optional<Project> findFirstByOwnerId(Long ownerId);

    void deleteById(String projectId);
}
