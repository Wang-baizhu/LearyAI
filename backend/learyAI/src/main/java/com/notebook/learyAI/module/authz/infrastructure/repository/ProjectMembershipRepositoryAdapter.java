// Responsibility: Adapt existing project repositories into authz membership query contract.
package com.notebook.learyAI.module.authz.infrastructure.repository;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class ProjectMembershipRepositoryAdapter implements MembershipQueryRepository {
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectMembershipRepositoryAdapter(ProjectRepository projectRepository,
                                              ProjectMemberRepository projectMemberRepository) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    @Override
    public boolean projectExists(String projectId) {
        return projectRepository.existsById(projectId);
    }

    @Override
    public Optional<ProjectRole> findRole(String projectId, long userId) {
        return projectMemberRepository.findActiveRole(projectId, userId).map(this::toProjectRole);
    }

    private ProjectRole toProjectRole(ProjectMemberRole role) {
        if (role == null) {
            return null;
        }
        return switch (role) {
            case OWNER -> ProjectRole.OWNER;
            case ADMIN -> ProjectRole.ADMIN;
            case MEMBER -> ProjectRole.MEMBER;
        };
    }
}

