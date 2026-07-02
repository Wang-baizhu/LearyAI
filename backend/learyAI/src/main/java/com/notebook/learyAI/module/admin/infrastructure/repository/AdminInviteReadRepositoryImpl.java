// Responsibility: Implement admin invite read-only list/detail queries with persistence filtering.
package com.notebook.learyAI.module.admin.infrastructure.repository;

import com.notebook.learyAI.module.admin.domain.repository.AdminInviteReadRepository;
import com.notebook.learyAI.module.project.infrastructure.persistence.po.ProjectInvitePO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class AdminInviteReadRepositoryImpl implements AdminInviteReadRepository {
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public InvitePageResult findInvites(String status,
                                        UUID projectId,
                                        Long creatorUserId,
                                        Instant now,
                                        int page,
                                        int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 100));
        long offset = (long) safePage * safeSize;

        Long total = entityManager.createQuery("""
                        select count(i.id)
                        from ProjectInvitePO i
                        where i.projectId = coalesce(:projectId, i.projectId)
                          and i.creatorId = coalesce(:creatorUserId, i.creatorId)
                          and (
                                coalesce(:status, '') = ''
                                or (:status = 'REVOKED' and i.status = 'REVOKED')
                                or (:status = 'EXPIRED' and (i.status = 'EXPIRED'
                                    or (i.status <> 'REVOKED' and i.expiresAt is not null and i.expiresAt < :now)))
                                or (:status = 'USED_UP' and i.status = 'ACTIVE'
                                    and (i.expiresAt is null or i.expiresAt >= :now)
                                    and i.usedCount >= i.maxUse)
                                or (:status = 'ACTIVE' and i.status = 'ACTIVE'
                                    and (i.expiresAt is null or i.expiresAt >= :now)
                                    and i.usedCount < i.maxUse)
                            )
                        """, Long.class)
                .setParameter("status", status)
                .setParameter("projectId", projectId)
                .setParameter("creatorUserId", creatorUserId)
                .setParameter("now", now)
                .getSingleResult();

        List<InviteRow> items = entityManager.createQuery("""
                        select i
                        from ProjectInvitePO i
                        where i.projectId = coalesce(:projectId, i.projectId)
                          and i.creatorId = coalesce(:creatorUserId, i.creatorId)
                          and (
                                coalesce(:status, '') = ''
                                or (:status = 'REVOKED' and i.status = 'REVOKED')
                                or (:status = 'EXPIRED' and (i.status = 'EXPIRED'
                                    or (i.status <> 'REVOKED' and i.expiresAt is not null and i.expiresAt < :now)))
                                or (:status = 'USED_UP' and i.status = 'ACTIVE'
                                    and (i.expiresAt is null or i.expiresAt >= :now)
                                    and i.usedCount >= i.maxUse)
                                or (:status = 'ACTIVE' and i.status = 'ACTIVE'
                                    and (i.expiresAt is null or i.expiresAt >= :now)
                                    and i.usedCount < i.maxUse)
                            )
                        order by i.createdAt desc, i.id desc
                        """, ProjectInvitePO.class)
                .setParameter("status", status)
                .setParameter("projectId", projectId)
                .setParameter("creatorUserId", creatorUserId)
                .setParameter("now", now)
                .setFirstResult((int) Math.min(offset, Integer.MAX_VALUE))
                .setMaxResults(safeSize)
                .getResultList()
                .stream()
                .map(this::toRow)
                .toList();

        return new InvitePageResult(total == null ? 0L : total, items);
    }

    @Override
    public Optional<InviteRow> findById(long inviteId) {
        ProjectInvitePO po = entityManager.find(ProjectInvitePO.class, inviteId);
        return po == null ? Optional.empty() : Optional.of(toRow(po));
    }

    private InviteRow toRow(ProjectInvitePO po) {
        return new InviteRow(
                po.getId(),
                po.getProjectId(),
                po.getCreatorId(),
                po.getStatus(),
                po.getExpiresAt(),
                po.getMaxUse(),
                po.getUsedCount(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }
}
