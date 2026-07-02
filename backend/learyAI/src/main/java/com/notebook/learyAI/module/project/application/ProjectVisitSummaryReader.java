// Responsibility: Provide project summaries for visit aggregation.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.module.visit.application.VisitResourceSummary;
import com.notebook.learyAI.module.visit.application.VisitResourceSummaryReader;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class ProjectVisitSummaryReader implements VisitResourceSummaryReader {
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;

    public ProjectVisitSummaryReader(ProjectRepository projectRepository,
                                     ProjectMemberRepository projectMemberRepository) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
    }

    @Override
    public boolean supports(UserResourceType resourceType) {
        return resourceType == UserResourceType.PROJECT;
    }

    @Override
    public Map<String, VisitResourceSummary> loadSummaries(Long userId, List<String> resourceIds) {
        if (resourceIds == null || resourceIds.isEmpty()) {
            return Map.of();
        }
        Set<String> allowedProjectIds = projectMemberRepository.findByUserId(userId).stream()
                .map(ProjectMember::getProjectId)
                .filter(projectId -> projectId != null && !projectId.isBlank())
                .collect(Collectors.toSet());
        List<String> readableIds = resourceIds.stream()
                .filter(allowedProjectIds::contains)
                .collect(Collectors.toList());
        if (readableIds.isEmpty()) {
            return Map.of();
        }
        Map<String, VisitResourceSummary> summaries = new LinkedHashMap<>();
        for (Project project : projectRepository.findByIds(readableIds)) {
            summaries.put(project.getId(), new VisitResourceSummary(project.getName(), null, project.getId(), null));
        }
        return summaries;
    }
}
