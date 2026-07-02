// Responsibility: Handle project and member use cases.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.auth.domain.model.User;
import com.notebook.learyAI.module.auth.domain.repository.UserRepository;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzCacheEvictor;
import com.notebook.learyAI.module.kb.application.KnowledgeBaseAppService;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectInviteRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.module.project.domain.service.ProjectMembershipDomainService;
import com.notebook.learyAI.module.visit.application.UserResourceVisitAppService;
import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectAppService {
    private static final int MAX_NAME_LENGTH = 128;
    private static final int MAX_RECENT_LIMIT = 50;
    private static final int MAX_PAGE_SIZE = 100;

    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectInviteRepository projectInviteRepository;
    private final UserResourceVisitAppService visitAppService;
    private final UserRepository userRepository;
    private final PermissionSupport permissionSupport;
    private final KnowledgeBaseAppService knowledgeBaseAppService;
    private final AuthzCacheEvictor authzCacheEvictor;
    private final ProjectMembershipDomainService projectMembershipDomainService = new ProjectMembershipDomainService();

    public ProjectAppService(ProjectRepository projectRepository,
                             ProjectMemberRepository projectMemberRepository,
                             ProjectInviteRepository projectInviteRepository,
                             UserResourceVisitAppService visitAppService,
                             UserRepository userRepository,
                             PermissionSupport permissionSupport,
                             KnowledgeBaseAppService knowledgeBaseAppService,
                             AuthzCacheEvictor authzCacheEvictor) {
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.projectInviteRepository = projectInviteRepository;
        this.visitAppService = visitAppService;
        this.userRepository = userRepository;
        this.permissionSupport = permissionSupport;
        this.knowledgeBaseAppService = knowledgeBaseAppService;
        this.authzCacheEvictor = authzCacheEvictor;
    }

    public ProjectMemberPage listProjects(Integer page, Integer size) {
        int safePage = page == null ? 1 : page;
        int safeSize = size == null ? 20 : size;
        if (safePage < 1 || safeSize < 1 || safeSize > MAX_PAGE_SIZE) {
            throw new BizException("PROJECT-400", "invalid page/size");
        }
        Long userId = requireUserId();
        List<ProjectMember> memberships = projectMemberRepository.findByUserId(userId);
        if (memberships.isEmpty()) {
            return new ProjectMemberPage(List.of(), 0, safePage, safeSize);
        }
        List<String> projectIds = memberships.stream()
                .map(ProjectMember::getProjectId)
                .filter(id -> id != null && !id.isBlank())
                .collect(Collectors.toList());
        if (projectIds.isEmpty()) {
            return new ProjectMemberPage(List.of(), 0, safePage, safeSize);
        }
        List<Project> projects = projectRepository.findByIds(projectIds);
        Map<String, Project> projectById = projects.stream()
                .collect(Collectors.toMap(Project::getId, project -> project));
        List<ProjectMemberSummary> summaries = memberships.stream()
                .map(member -> {
                    Project project = projectById.get(member.getProjectId());
                    if (project == null) {
                        return null;
                    }
                    return new ProjectMemberSummary(project.getId(), project.getName(), member.getRole(),
                            project.getCreatedAt(), project.getUpdatedAt());
                })
                .filter(summary -> summary != null)
                .sorted(Comparator.comparing(ProjectMemberSummary::getCreatedAt).reversed())
                .collect(Collectors.toList());
        int total = summaries.size();
        int fromIndex = (safePage - 1) * safeSize;
        if (fromIndex >= total) {
            return new ProjectMemberPage(List.of(), total, safePage, safeSize);
        }
        int toIndex = Math.min(fromIndex + safeSize, total);
        List<ProjectMemberSummary> items = summaries.subList(fromIndex, toIndex);
        return new ProjectMemberPage(items, total, safePage, safeSize);
    }

    @Transactional
    public ProjectMemberSummary createProject(String name) {
        Long userId = requireUserId();
        String normalizedName = normalizeName(name);
        Instant now = Instant.now();
        String projectId = UUID.randomUUID().toString();
        Project project = new Project(projectId, normalizedName, userId, now, now);
        projectRepository.save(project);
        ProjectMember member = new ProjectMember(null, projectId, userId, ProjectMemberRole.OWNER,
                ProjectMemberStatus.ACTIVE, now, now);
        projectMemberRepository.save(member);
        authzCacheEvictor.evictProjectExists(projectId);
        authzCacheEvictor.evictRole(projectId, userId);
        visitAppService.recordVisit(userId, UserResourceType.PROJECT, projectId, now);
        return new ProjectMemberSummary(projectId, normalizedName, ProjectMemberRole.OWNER, now, now);
    }

    @Transactional
    public ProjectMemberSummary createInitialProject(Long userId, String name) {
        if (userId == null) {
            throw new BizException("PROJECT-400", "userId required");
        }
        String normalizedName = normalizeName(name);
        Instant now = Instant.now();
        String projectId = UUID.randomUUID().toString();
        Project project = new Project(projectId, normalizedName, userId, now, now);
        projectRepository.save(project);
        ProjectMember member = new ProjectMember(null, projectId, userId, ProjectMemberRole.OWNER,
                ProjectMemberStatus.ACTIVE, now, now);
        projectMemberRepository.save(member);
        authzCacheEvictor.evictProjectExists(projectId);
        authzCacheEvictor.evictRole(projectId, userId);
        visitAppService.recordVisit(userId, UserResourceType.PROJECT, projectId, now);
        return new ProjectMemberSummary(projectId, normalizedName, ProjectMemberRole.OWNER, now, now);
    }

    public ProjectMemberDetailPage listMembers(String projectId, Integer page, Integer size) {
        int safePage = page == null ? 1 : page;
        int safeSize = size == null ? 20 : size;
        if (safePage < 1 || safeSize < 1 || safeSize > MAX_PAGE_SIZE) {
            throw new BizException("PROJECT-400", "invalid page/size");
        }
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireMemberRole(normalizedProjectId, userId);
        List<ProjectMember> members = projectMemberRepository.findByProjectId(normalizedProjectId).stream()
                .sorted(Comparator.comparing(ProjectMember::getCreatedAt).reversed())
                .collect(Collectors.toList());
        int total = members.size();
        int fromIndex = (safePage - 1) * safeSize;
        if (fromIndex >= total) {
            return new ProjectMemberDetailPage(List.of(), total, safePage, safeSize);
        }
        int toIndex = Math.min(fromIndex + safeSize, total);
        List<ProjectMember> pageItems = members.subList(fromIndex, toIndex);
        List<Long> userIds = pageItems.stream()
                .map(ProjectMember::getUserId)
                .filter(id -> id != null)
                .collect(Collectors.toList());
        Map<Long, User> userById = userRepository.findByIds(userIds).stream()
                .collect(Collectors.toMap(User::getId, user -> user, (a, b) -> a));
        List<ProjectMemberDetail> items = pageItems.stream()
                .map(member -> {
                    User user = userById.get(member.getUserId());
                    String name = user == null ? null : user.getName();
                    if (name == null || name.isBlank()) {
                        name = user == null ? null : user.getEmail();
                    }
                    return new ProjectMemberDetail(member.getUserId(), name, member.getRole(), member.getStatus(),
                            member.getCreatedAt());
                })
                .collect(Collectors.toList());
        return new ProjectMemberDetailPage(items, total, safePage, safeSize);
    }

    @Transactional
    public void removeMember(String projectId, Long targetUserId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        if (targetUserId == null) {
            throw new BizException("PROJECT-400", "userId required");
        }
        projectMembershipDomainService.requireNotSelf(userId, targetUserId, "PROJECT-400", "owner cannot remove self");
        projectMemberRepository.deleteByProjectIdAndUserId(normalizedProjectId, targetUserId);
        authzCacheEvictor.evictRole(normalizedProjectId, targetUserId);
    }

    @Transactional
    public void leaveProject(String projectId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        ProjectMemberRole role = requireMemberRole(normalizedProjectId, userId);
        projectMembershipDomainService.requireNotOwner(role, "PROJECT-400", "owner cannot leave project");
        projectMemberRepository.deleteByProjectIdAndUserId(normalizedProjectId, userId);
        authzCacheEvictor.evictRole(normalizedProjectId, userId);
    }

    @Transactional
    public void transferOwner(String projectId, Long targetUserId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        if (targetUserId == null) {
            throw new BizException("PROJECT-400", "userId required");
        }
        projectMembershipDomainService.requireNotSelf(userId, targetUserId, "PROJECT-400", "owner cannot transfer to self");
        ProjectMember targetMember = projectMemberRepository.findByProjectIdAndUserId(normalizedProjectId, targetUserId)
                .orElseThrow(() -> new BizException("PROJECT-404", "member not found"));
        projectMembershipDomainService.requireActiveMember(targetMember, "PROJECT-400", "member inactive");
        ProjectMember currentOwner = projectMemberRepository.findByProjectIdAndUserId(normalizedProjectId, userId)
                .orElseThrow(() -> new BizException("PROJECT-404", "member not found"));
        Project project = projectRepository.findById(normalizedProjectId)
                .orElseThrow(() -> new BizException("PROJECT-404", "project not found"));
        Instant now = Instant.now();
        Project updatedProject = projectMembershipDomainService.transferOwnership(project, targetUserId, now);
        projectRepository.save(updatedProject);
        ProjectMember updatedTarget = projectMembershipDomainService.updateRole(targetMember, ProjectMemberRole.OWNER, now);
        projectMemberRepository.save(updatedTarget);
        ProjectMember updatedOwner = projectMembershipDomainService.updateRole(currentOwner, ProjectMemberRole.ADMIN, now);
        projectMemberRepository.save(updatedOwner);
        authzCacheEvictor.evictRoles(normalizedProjectId, List.of(targetUserId, userId));
    }

    @Transactional
    public void changeMemberRole(String projectId, Long targetUserId, ProjectMemberRole targetRole) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        if (targetUserId == null) {
            throw new BizException("PROJECT-400", "userId required");
        }
        projectMembershipDomainService.requireNotSelf(userId, targetUserId, "PROJECT-400", "owner cannot change self role");
        ProjectMemberRole resolvedRole = projectMembershipDomainService.resolveAssignableRole(targetRole,
                "PROJECT-400", "role required", "PROJECT-400", "owner role not allowed");
        ProjectMember targetMember = projectMemberRepository.findByProjectIdAndUserId(normalizedProjectId, targetUserId)
                .orElseThrow(() -> new BizException("PROJECT-404", "member not found"));
        projectMembershipDomainService.requireActiveMember(targetMember, "PROJECT-400", "member inactive");
        if (targetMember.getRole() == resolvedRole) {
            return;
        }
        Instant now = Instant.now();
        ProjectMember updatedMember = projectMembershipDomainService.updateRole(targetMember, resolvedRole, now);
        projectMemberRepository.save(updatedMember);
        authzCacheEvictor.evictRole(normalizedProjectId, targetUserId);
    }

    @Transactional
    public void deleteProject(String projectId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        visitAppService.deleteByResource(UserResourceType.PROJECT, normalizedProjectId);
        knowledgeBaseAppService.deleteByProject(normalizedProjectId);
        projectInviteRepository.deleteByProjectId(normalizedProjectId);
        projectMemberRepository.deleteByProjectId(normalizedProjectId);
        projectRepository.deleteById(normalizedProjectId);
        authzCacheEvictor.evictProjectExists(normalizedProjectId);
        authzCacheEvictor.evictProjectRoles(normalizedProjectId);
    }

    @Transactional
    public ProjectMemberSummary renameProject(String projectId, String name) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwnerRole(normalizedProjectId, userId);
        String normalizedName = normalizeName(name);
        Project project = projectRepository.findById(normalizedProjectId)
                .orElseThrow(() -> new BizException("PROJECT-404", "project not found"));
        Instant now = Instant.now();
        Project updated = new Project(project.getId(), normalizedName, project.getOwnerId(),
                project.getCreatedAt(), now);
        projectRepository.save(updated);
        return new ProjectMemberSummary(updated.getId(), updated.getName(), ProjectMemberRole.OWNER,
                updated.getCreatedAt(), updated.getUpdatedAt());
    }

    private Long requireUserId() {
        return permissionSupport.requireUserId();
    }

    private String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            throw new BizException("PROJECT-400", "name required");
        }
        String trimmed = name.trim();
        if (trimmed.length() > MAX_NAME_LENGTH) {
            throw new BizException("PROJECT-400", "name too long");
        }
        return trimmed;
    }

    private String requireProjectId(String projectId) {
        return permissionSupport.requireProjectId(projectId, "PROJECT-400", "PROJECT-400", "PROJECT-404");
    }

    private ProjectMemberRole requireMemberRole(String projectId, Long userId) {
        return permissionSupport.requireMemberRole(projectId, userId, "PROJECT-403", "project access denied");
    }

    private void requireOwnerRole(String projectId, Long userId) {
        permissionSupport.requireOwnerRole(projectId, userId, "PROJECT-403", "project access denied",
                "PROJECT-403", "permission denied");
    }

    public static class ProjectMemberSummary {
        private final String projectId;
        private final String name;
        private final ProjectMemberRole role;
        private final Instant createdAt;
        private final Instant updatedAt;

        public ProjectMemberSummary(String projectId, String name, ProjectMemberRole role, Instant createdAt,
                                    Instant updatedAt) {
            this.projectId = projectId;
            this.name = name;
            this.role = role;
            this.createdAt = createdAt;
            this.updatedAt = updatedAt;
        }

        public String getProjectId() {
            return projectId;
        }

        public String getName() {
            return name;
        }

        public ProjectMemberRole getRole() {
            return role;
        }

        public Instant getCreatedAt() {
            return createdAt;
        }

        public Instant getUpdatedAt() {
            return updatedAt;
        }
    }

    public static class ProjectMemberPage {
        private final List<ProjectMemberSummary> items;
        private final long total;
        private final int page;
        private final int size;

        public ProjectMemberPage(List<ProjectMemberSummary> items, long total, int page, int size) {
            this.items = items;
            this.total = total;
            this.page = page;
            this.size = size;
        }

        public List<ProjectMemberSummary> getItems() {
            return items;
        }

        public long getTotal() {
            return total;
        }

        public int getPage() {
            return page;
        }

        public int getSize() {
            return size;
        }
    }

    public static class ProjectMemberDetail {
        private final Long userId;
        private final String name;
        private final ProjectMemberRole role;
        private final ProjectMemberStatus status;
        private final Instant createdAt;

        public ProjectMemberDetail(Long userId, String name, ProjectMemberRole role, ProjectMemberStatus status,
                                   Instant createdAt) {
            this.userId = userId;
            this.name = name;
            this.role = role;
            this.status = status;
            this.createdAt = createdAt;
        }

        public Long getUserId() {
            return userId;
        }

        public String getName() {
            return name;
        }

        public ProjectMemberRole getRole() {
            return role;
        }

        public ProjectMemberStatus getStatus() {
            return status;
        }

        public Instant getCreatedAt() {
            return createdAt;
        }
    }

    public static class ProjectMemberDetailPage {
        private final List<ProjectMemberDetail> items;
        private final long total;
        private final int page;
        private final int size;

        public ProjectMemberDetailPage(List<ProjectMemberDetail> items, long total, int page, int size) {
            this.items = items;
            this.total = total;
            this.page = page;
            this.size = size;
        }

        public List<ProjectMemberDetail> getItems() {
            return items;
        }

        public long getTotal() {
            return total;
        }

        public int getPage() {
            return page;
        }

        public int getSize() {
            return size;
        }
    }
}
