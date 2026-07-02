// Responsibility: Implement visit repository using JPA persistence.
package com.notebook.learyAI.module.visit.infrastructure.repository;

import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;
import com.notebook.learyAI.module.visit.domain.repository.UserResourceVisitRepository;
import com.notebook.learyAI.module.visit.infrastructure.persistence.po.UserResourceVisitPO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Repository
public class UserResourceVisitRepositoryImpl implements UserResourceVisitRepository {
    private final EntityManager entityManager;

    public UserResourceVisitRepositoryImpl(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public void upsert(Long userId, UserResourceType resourceType, String resourceId, Instant visitedAt) {
        entityManager.createNativeQuery(
                        "insert into user_resource_visit (user_id, resource_type, resource_id, last_visited_at,"
                                + " created_at, updated_at)"
                                + " values (:userId, :resourceType, :resourceId, :visitedAt, :now, :now)"
                                + " on conflict (user_id, resource_type, resource_id)"
                                + " do update set last_visited_at = excluded.last_visited_at,"
                                + " updated_at = excluded.updated_at")
                .setParameter("userId", userId)
                .setParameter("resourceType", resourceType.name())
                .setParameter("resourceId", resourceId)
                .setParameter("visitedAt", visitedAt)
                .setParameter("now", Instant.now())
                .executeUpdate();
    }

    @Override
    public List<UserResourceVisit> findRecentByUserAndType(Long userId, UserResourceType resourceType, int limit) {
        TypedQuery<UserResourceVisitPO> query = entityManager.createQuery(
                "select v from UserResourceVisitPO v where v.userId = :userId and v.resourceType = :resourceType"
                        + " order by v.lastVisitedAt desc",
                UserResourceVisitPO.class);
        query.setParameter("userId", userId);
        query.setParameter("resourceType", resourceType.name());
        query.setMaxResults(limit);
        List<UserResourceVisit> items = new ArrayList<>();
        for (UserResourceVisitPO po : query.getResultList()) {
            items.add(toDomain(po));
        }
        return items;
    }

    @Override
    public List<UserResourceVisit> findRecentByUser(Long userId, Instant cursorVisitedAt, Long cursorId, int limit) {
        StringBuilder jpql = new StringBuilder("select v from UserResourceVisitPO v where v.userId = :userId");
        if (cursorVisitedAt != null && cursorId != null) {
            jpql.append(" and (v.lastVisitedAt < :cursorVisitedAt")
                    .append(" or (v.lastVisitedAt = :cursorVisitedAt and v.id < :cursorId))");
        }
        jpql.append(" order by v.lastVisitedAt desc, v.id desc");
        TypedQuery<UserResourceVisitPO> query = entityManager.createQuery(jpql.toString(), UserResourceVisitPO.class);
        query.setParameter("userId", userId);
        if (cursorVisitedAt != null && cursorId != null) {
            query.setParameter("cursorVisitedAt", cursorVisitedAt);
            query.setParameter("cursorId", cursorId);
        }
        query.setMaxResults(limit);
        List<UserResourceVisit> items = new ArrayList<>();
        for (UserResourceVisitPO po : query.getResultList()) {
            items.add(toDomain(po));
        }
        return items;
    }

    @Override
    public void deleteByResource(UserResourceType resourceType, String resourceId) {
        entityManager.createQuery(
                        "delete from UserResourceVisitPO v where v.resourceType = :resourceType"
                                + " and v.resourceId = :resourceId")
                .setParameter("resourceType", resourceType.name())
                .setParameter("resourceId", resourceId)
                .executeUpdate();
    }

    private UserResourceVisit toDomain(UserResourceVisitPO po) {
        return new UserResourceVisit(po.getId(), po.getUserId(), UserResourceType.valueOf(po.getResourceType()),
                po.getResourceId(), po.getLastVisitedAt(), po.getCreatedAt(), po.getUpdatedAt());
    }
}
