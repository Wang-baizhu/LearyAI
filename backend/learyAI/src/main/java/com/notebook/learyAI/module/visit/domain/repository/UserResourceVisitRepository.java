// Responsibility: Visit repository abstraction.
package com.notebook.learyAI.module.visit.domain.repository;

import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;

import java.time.Instant;
import java.util.List;

public interface UserResourceVisitRepository {
    void upsert(Long userId, UserResourceType resourceType, String resourceId, Instant visitedAt);

    List<UserResourceVisit> findRecentByUserAndType(Long userId, UserResourceType resourceType, int limit);

    List<UserResourceVisit> findRecentByUser(Long userId, Instant cursorVisitedAt, Long cursorId, int limit);

    void deleteByResource(UserResourceType resourceType, String resourceId);
}
