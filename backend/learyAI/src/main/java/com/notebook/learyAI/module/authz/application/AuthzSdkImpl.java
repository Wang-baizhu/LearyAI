// Responsibility: Implement the authz SDK facade by reusing project membership data and policy checks.
package com.notebook.learyAI.module.authz.application;

import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.application.cache.CachedValue;
import com.notebook.learyAI.module.authz.domain.model.Action;
import com.notebook.learyAI.module.authz.domain.model.AuthzDecision;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class AuthzSdkImpl implements AuthzSdk {
    private static final String CODE_PROJECT_FORBIDDEN = "PROJECT-403";
    private static final String CODE_PROJECT_NOT_FOUND = "PROJECT-404";
    private static final String CODE_AUTHZ_ERROR = "AUTHZ-500";

    private final MembershipQueryRepository membershipQueryRepository;
    private final AuthzPolicyService authzPolicyService;
    private final AuthzQueryCache authzQueryCache;

    public AuthzSdkImpl(MembershipQueryRepository membershipQueryRepository,
                        AuthzPolicyService authzPolicyService,
                        AuthzQueryCache authzQueryCache) {
        this.membershipQueryRepository = membershipQueryRepository;
        this.authzPolicyService = authzPolicyService;
        this.authzQueryCache = authzQueryCache;
    }

    @Override
    public Long requireUserId() {
        Long current = CurrentUserContext.getUserId();
        if (current == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        return current;
    }

    @Override
    public String requireProjectId(String projectId, String requiredCode, String invalidCode, String notFoundCode) {
        if (projectId == null || projectId.isBlank()) {
            throw new BizException(requiredCode, "projectId required");
        }
        String normalized = projectId.trim();
        try {
            UUID.fromString(normalized);
        } catch (IllegalArgumentException ex) {
            throw new BizException(invalidCode, "projectId invalid");
        }
        if (!projectExists(normalized)) {
            throw new BizException(notFoundCode, "project not found");
        }
        return normalized;
    }

    @Override
    public AuthzDecision authorize(long userId, String projectId, Action action) {
        try {
            if (projectId == null || projectId.isBlank() || !projectExists(projectId.trim())) {
                return AuthzDecision.deny(CODE_PROJECT_NOT_FOUND, "project not found", null);
            }
            Optional<ProjectRole> roleOpt = findRole(projectId.trim(), userId);
            if (roleOpt.isEmpty()) {
                return AuthzDecision.deny(CODE_PROJECT_FORBIDDEN, "project access denied", null);
            }
            ProjectRole role = roleOpt.get();
            if (!authzPolicyService.isAllowed(role, action)) {
                return AuthzDecision.deny(CODE_PROJECT_FORBIDDEN, "action forbidden", role);
            }
            return AuthzDecision.allow(role);
        } catch (RuntimeException ex) {
            return AuthzDecision.deny(CODE_AUTHZ_ERROR, "authz internal error", null);
        }
    }

    @Override
    public ProjectRole requireRole(long userId, String projectId, Set<ProjectRole> allowedRoles) {
        if (allowedRoles == null || allowedRoles.isEmpty()) {
            throw new BizException(CODE_AUTHZ_ERROR, "allowedRoles required");
        }
        if (projectId == null || projectId.isBlank() || !projectExists(projectId.trim())) {
            throw new BizException(CODE_PROJECT_NOT_FOUND, "project not found");
        }
        ProjectRole role = findRole(projectId.trim(), userId)
                .orElseThrow(() -> new BizException(CODE_PROJECT_FORBIDDEN, "project access denied"));
        if (!allowedRoles.contains(role)) {
            throw new BizException(CODE_PROJECT_FORBIDDEN, "project access denied");
        }
        return role;
    }

    @Override
    public boolean isMember(long userId, String projectId) {
        if (projectId == null || projectId.isBlank() || !projectExists(projectId.trim())) {
            return false;
        }
        return findRole(projectId.trim(), userId).isPresent();
    }

    private boolean projectExists(String projectId) {
        CachedValue<Boolean> cached = authzQueryCache.getProjectExists(projectId);
        if (cached.isHit()) {
            return Boolean.TRUE.equals(cached.getValue());
        }
        boolean exists = membershipQueryRepository.projectExists(projectId);
        authzQueryCache.putProjectExists(projectId, exists);
        return exists;
    }

    private Optional<ProjectRole> findRole(String projectId, long userId) {
        CachedValue<ProjectRole> cached = authzQueryCache.getRole(projectId, userId);
        if (cached.isHit()) {
            return Optional.ofNullable(cached.getValue());
        }
        Optional<ProjectRole> roleOpt = membershipQueryRepository.findRole(projectId, userId);
        authzQueryCache.putRole(projectId, userId, roleOpt.orElse(null));
        return roleOpt;
    }
}
