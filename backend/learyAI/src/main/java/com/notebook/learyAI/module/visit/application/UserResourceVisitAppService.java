// Responsibility: Handle visit recording and query use cases.
package com.notebook.learyAI.module.visit.application;

import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;
import com.notebook.learyAI.module.visit.domain.repository.UserResourceVisitRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class UserResourceVisitAppService {
    private final UserResourceVisitRepository repository;

    public UserResourceVisitAppService(UserResourceVisitRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void recordVisit(Long userId, UserResourceType resourceType, String resourceId, Instant visitedAt) {
        if (userId == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        if (resourceType == null) {
            throw new BizException("VISIT-400", "resourceType required");
        }
        if (resourceId == null || resourceId.isBlank()) {
            throw new BizException("VISIT-400", "resourceId required");
        }
        Instant resolvedTime = visitedAt == null ? Instant.now() : visitedAt;
        repository.upsert(userId, resourceType, resourceId.trim(), resolvedTime);
    }

    public List<String> listRecentResourceIds(Long userId, UserResourceType resourceType, int limit) {
        if (userId == null) {
            throw new BizException("UNAUTHORIZED", "未授权");
        }
        if (resourceType == null) {
            throw new BizException("VISIT-400", "resourceType required");
        }
        if (limit < 1) {
            throw new BizException("VISIT-400", "limit invalid");
        }
        List<UserResourceVisit> visits = repository.findRecentByUserAndType(userId, resourceType, limit);
        return visits.stream()
                .map(UserResourceVisit::getResourceId)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteByResource(UserResourceType resourceType, String resourceId) {
        if (resourceType == null) {
            throw new BizException("VISIT-400", "resourceType required");
        }
        if (resourceId == null || resourceId.isBlank()) {
            throw new BizException("VISIT-400", "resourceId required");
        }
        repository.deleteByResource(resourceType, resourceId.trim());
    }
}
