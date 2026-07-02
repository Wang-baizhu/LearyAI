// Responsibility: Verify visit repository persistence semantics with real PostgreSQL behavior.
package com.notebook.learyAI.module.visit.infrastructure.repository;

import com.notebook.learyAI.module.visit.domain.model.UserResourceType;
import com.notebook.learyAI.module.visit.domain.model.UserResourceVisit;
import com.notebook.learyAI.module.visit.infrastructure.persistence.po.UserResourceVisitPO;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Transactional
class UserResourceVisitRepositoryImplIntegrationTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private EntityManager entityManager;

    private UserResourceVisitRepositoryImpl repository;

    @BeforeEach
    void setUp() {
        repository = new UserResourceVisitRepositoryImpl(entityManager);
    }

    @Test
    @DisplayName("upsert: 同(userId,type,resourceId)二次写入应更新 visitedAt/updatedAt 且不新增重复行")
    void upsert_shouldUpdateInConflictWithoutDuplicate() {
        Long userId = nextUserId();
        String resourceId = "kb-" + UUID.randomUUID();
        Instant first = Instant.parse("2026-03-06T00:00:00Z");
        Instant second = Instant.parse("2026-03-06T01:00:00Z");

        repository.upsert(userId, UserResourceType.KB, resourceId, first);
        repository.upsert(userId, UserResourceType.KB, resourceId, second);
        entityManager.flush();
        entityManager.clear();

        List<UserResourceVisitPO> rows = entityManager.createQuery(
                        "select v from UserResourceVisitPO v where v.userId = :uid and v.resourceType = :type and v.resourceId = :rid",
                        UserResourceVisitPO.class)
                .setParameter("uid", userId)
                .setParameter("type", "KB")
                .setParameter("rid", resourceId)
                .getResultList();

        assertEquals(1, rows.size());
        assertEquals(second, rows.get(0).getLastVisitedAt());
        assertTrue(!rows.get(0).getUpdatedAt().isBefore(rows.get(0).getCreatedAt()));
    }

    @Test
    @DisplayName("findRecentByUserAndType: 多次 upsert 后应按 visitedAt desc 返回并受 limit 限制")
    void findRecentByUserAndType_shouldOrderByVisitedAtDescAndRespectLimit() {
        Long userId = nextUserId();
        String id1 = "kb-" + UUID.randomUUID();
        String id2 = "kb-" + UUID.randomUUID();
        String id3 = "kb-" + UUID.randomUUID();
        repository.upsert(userId, UserResourceType.KB, id1, Instant.parse("2026-03-06T01:00:00Z"));
        repository.upsert(userId, UserResourceType.KB, id2, Instant.parse("2026-03-06T03:00:00Z"));
        repository.upsert(userId, UserResourceType.KB, id3, Instant.parse("2026-03-06T02:00:00Z"));
        entityManager.flush();
        entityManager.clear();

        List<UserResourceVisit> recent = repository.findRecentByUserAndType(userId, UserResourceType.KB, 2);

        assertEquals(2, recent.size());
        assertEquals(List.of(id2, id3), recent.stream().map(UserResourceVisit::getResourceId).toList());
    }

    @Test
    @DisplayName("deleteByResource: 删除同资源的多用户记录，不影响其他资源")
    void deleteByResource_shouldDeleteOnlyTargetResourceAcrossUsers() {
        Long userIdA = nextUserId();
        Long userIdB = nextUserId();
        String targetId = "kb-" + UUID.randomUUID();
        String untouchedId = "kb-" + UUID.randomUUID();
        repository.upsert(userIdA, UserResourceType.KB, targetId, Instant.parse("2026-03-06T01:00:00Z"));
        repository.upsert(userIdB, UserResourceType.KB, targetId, Instant.parse("2026-03-06T02:00:00Z"));
        repository.upsert(userIdA, UserResourceType.KB, untouchedId, Instant.parse("2026-03-06T03:00:00Z"));
        entityManager.flush();

        repository.deleteByResource(UserResourceType.KB, targetId);
        entityManager.flush();
        entityManager.clear();

        Long remain = entityManager.createQuery(
                        "select count(v) from UserResourceVisitPO v where v.resourceType = :type and v.resourceId = :rid",
                        Long.class)
                .setParameter("type", "KB")
                .setParameter("rid", targetId)
                .getSingleResult();
        Long untouched = entityManager.createQuery(
                        "select count(v) from UserResourceVisitPO v where v.resourceType = :type and v.resourceId = :rid",
                        Long.class)
                .setParameter("type", "KB")
                .setParameter("rid", untouchedId)
                .getSingleResult();

        assertEquals(0L, remain);
        assertEquals(1L, untouched);
    }

    @Test
    @DisplayName("findRecentByUser: 游标应按(visitedAt desc,id desc)稳定分页")
    void findRecentByUser_shouldApplyCursorAndKeepStableOrder() {
        Long userId = nextUserId();
        String id1 = "kb-" + UUID.randomUUID();
        String id2 = "kb-" + UUID.randomUUID();
        String id3 = "kb-" + UUID.randomUUID();
        Instant t3 = Instant.parse("2026-03-06T03:00:00Z");
        Instant t2 = Instant.parse("2026-03-06T02:00:00Z");
        repository.upsert(userId, UserResourceType.KB, id1, t3);
        repository.upsert(userId, UserResourceType.KB, id2, t3);
        repository.upsert(userId, UserResourceType.KB, id3, t2);
        entityManager.flush();
        entityManager.clear();

        List<UserResourceVisit> firstPage = repository.findRecentByUser(userId, null, null, 2);

        assertEquals(2, firstPage.size());
        assertEquals(List.of(id2, id1), firstPage.stream().map(UserResourceVisit::getResourceId).toList());
        UserResourceVisit cursor = firstPage.get(1);

        List<UserResourceVisit> secondPage = repository.findRecentByUser(
                userId, cursor.getLastVisitedAt(), cursor.getId(), 2
        );

        assertEquals(1, secondPage.size());
        assertEquals(id3, secondPage.get(0).getResourceId());
    }

    private Long nextUserId() {
        return Math.abs(UUID.randomUUID().getMostSignificantBits());
    }
}
