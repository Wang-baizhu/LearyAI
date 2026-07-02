// Responsibility: Handle project invite use cases.
package com.notebook.learyAI.module.project.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzCacheEvictor;
import com.notebook.learyAI.module.project.domain.model.ProjectInvite;
import com.notebook.learyAI.module.project.domain.model.ProjectInviteStatus;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectInviteRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.module.project.domain.service.ProjectInviteDomainService;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class ProjectInviteAppService {
    private static final int MAX_CODE_RETRY = 5;

    private final ProjectInviteRepository inviteRepository;
    private final ProjectRepository projectRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final AuthzCacheEvictor authzCacheEvictor;
    private final ProjectInviteDomainService projectInviteDomainService = new ProjectInviteDomainService();

    public ProjectInviteAppService(ProjectInviteRepository inviteRepository,
                                   ProjectRepository projectRepository,
                                   ProjectMemberRepository projectMemberRepository,
                                   AuthzCacheEvictor authzCacheEvictor) {
        this.inviteRepository = inviteRepository;
        this.projectRepository = projectRepository;
        this.projectMemberRepository = projectMemberRepository;
        this.authzCacheEvictor = authzCacheEvictor;
    }

    @Transactional
    public ProjectInviteSummary createInvite(String projectId, Integer maxUse, Instant expiresAt) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwner(normalizedProjectId, userId);
        Instant now = Instant.now();
        int resolvedMaxUse = projectInviteDomainService.resolveMaxUse(maxUse, "PROJECT-400", "maxUse invalid");
        projectInviteDomainService.requireExpiresAtNotPast(expiresAt, now, "PROJECT-400", "expiresAt invalid");
        String code = generateCode();
        ProjectInvite invite = new ProjectInvite(null, normalizedProjectId, code, userId, resolvedMaxUse, 0,
                ProjectInviteStatus.ACTIVE, expiresAt, now, now);
        ProjectInvite saved = inviteRepository.save(invite);
        return toSummary(saved);
    }

    public List<ProjectInviteSummary> listInvites(String projectId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwner(normalizedProjectId, userId);
        return inviteRepository.findByProjectId(normalizedProjectId).stream()
                .map(this::toSummary)
                .collect(Collectors.toList());
    }

    @Transactional
    public void revokeInvite(String projectId, Long inviteId) {
        Long userId = requireUserId();
        String normalizedProjectId = requireProjectId(projectId);
        requireOwner(normalizedProjectId, userId);
        ProjectInvite invite = inviteRepository.findById(inviteId)
                .orElseThrow(() -> new BizException("PROJECT-404", "invite not found"));
        if (!normalizedProjectId.equals(invite.getProjectId())) {
            throw new BizException("PROJECT-404", "invite not found");
        }
        if (invite.getStatus() == ProjectInviteStatus.REVOKED) {
            return;
        }
        ProjectInvite updated = invite.withStatus(ProjectInviteStatus.REVOKED, Instant.now());
        inviteRepository.save(updated);
    }

    @Transactional
    public ProjectAppService.ProjectMemberSummary acceptInvite(String inviteCode) {
        Long userId = requireUserId();
        String normalizedCode = projectInviteDomainService.normalizeCode(inviteCode, "PROJECT-400", "inviteCode required");
        ProjectInvite invite = inviteRepository.findByCode(normalizedCode)
                .orElseThrow(() -> new BizException("PROJECT-404", "invite not found"));
        Instant now = Instant.now();
        projectInviteDomainService.requireActive(invite, "PROJECT-400", "invite inactive");
        if (projectInviteDomainService.isExpired(invite, now)) {
            ProjectInvite expired = projectInviteDomainService.expire(invite, now);
            inviteRepository.save(expired);
            throw new BizException("PROJECT-400", "invite expired");
        }
        projectInviteDomainService.requireNotExceeded(invite, "PROJECT-400", "invite exceeded");
        String projectId = invite.getProjectId();
        ProjectMember existing = projectMemberRepository.findByProjectIdAndUserId(projectId, userId).orElse(null);
        if (existing != null && existing.getStatus() == ProjectMemberStatus.ACTIVE) {
            return loadProjectSummary(projectId, existing.getRole());
        }
        ProjectMember member = new ProjectMember(null, projectId, userId, ProjectMemberRole.MEMBER,
                ProjectMemberStatus.ACTIVE, now, now);
        projectMemberRepository.save(member);
        authzCacheEvictor.evictRole(projectId, userId);
        ProjectInvite updated = projectInviteDomainService.incrementUsage(invite, now);
        inviteRepository.save(updated);
        return loadProjectSummary(projectId, ProjectMemberRole.MEMBER);
    }

    private ProjectAppService.ProjectMemberSummary loadProjectSummary(String projectId, ProjectMemberRole role) {
        com.notebook.learyAI.module.project.domain.model.Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new BizException("PROJECT-404", "project not found"));
        return new ProjectAppService.ProjectMemberSummary(project.getId(), project.getName(), role,
                project.getCreatedAt(), project.getUpdatedAt());
    }

    private ProjectInviteSummary toSummary(ProjectInvite invite) {
        return new ProjectInviteSummary(invite.getId(), invite.getCode(), invite.getCreatorId(),
                invite.getMaxUse(), invite.getUsedCount(), invite.getStatus(), invite.getExpiresAt(),
                invite.getCreatedAt());
    }

    private Long requireUserId() {
        Long current = CurrentUserContext.getUserId();
        if (current == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        return current;
    }

    private String requireProjectId(String projectId) {
        if (projectId == null || projectId.isBlank()) {
            throw new BizException("PROJECT-400", "projectId required");
        }
        String normalized = projectId.trim();
        try {
            UUID.fromString(normalized);
        } catch (IllegalArgumentException ex) {
            throw new BizException("PROJECT-400", "projectId invalid");
        }
        if (!projectRepository.existsById(normalized)) {
            throw new BizException("PROJECT-404", "project not found");
        }
        return normalized;
    }

    private void requireOwner(String projectId, Long userId) {
        ProjectMemberRole role = projectMemberRepository.findActiveRole(projectId, userId).orElse(null);
        if (role != ProjectMemberRole.OWNER) {
            throw new BizException("PROJECT-403", "permission denied");
        }
    }

    private String generateCode() {
        for (int attempt = 0; attempt < MAX_CODE_RETRY; attempt++) {
            String code = UUID.randomUUID().toString().replace("-", "");
            if (inviteRepository.findByCode(code).isEmpty()) {
                return code;
            }
        }
        throw new BizException("PROJECT-500", "invite code generate failed");
    }

    public static class ProjectInviteSummary {
        private final Long id;
        private final String code;
        private final Long creatorId;
        private final int maxUse;
        private final int usedCount;
        private final ProjectInviteStatus status;
        private final Instant expiresAt;
        private final Instant createdAt;

        public ProjectInviteSummary(Long id, String code, Long creatorId, int maxUse, int usedCount,
                                    ProjectInviteStatus status, Instant expiresAt, Instant createdAt) {
            this.id = id;
            this.code = code;
            this.creatorId = creatorId;
            this.maxUse = maxUse;
            this.usedCount = usedCount;
            this.status = status;
            this.expiresAt = expiresAt;
            this.createdAt = createdAt;
        }

        public Long getId() {
            return id;
        }

        public String getCode() {
            return code;
        }

        public Long getCreatorId() {
            return creatorId;
        }

        public int getMaxUse() {
            return maxUse;
        }

        public int getUsedCount() {
            return usedCount;
        }

        public ProjectInviteStatus getStatus() {
            return status;
        }

        public Instant getExpiresAt() {
            return expiresAt;
        }

        public Instant getCreatedAt() {
            return createdAt;
        }
    }
}
