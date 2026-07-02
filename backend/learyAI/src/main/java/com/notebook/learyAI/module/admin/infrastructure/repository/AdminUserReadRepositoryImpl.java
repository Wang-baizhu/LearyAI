// Responsibility: Implement admin user read-only queries with direct persistence access.
package com.notebook.learyAI.module.admin.infrastructure.repository;

import com.notebook.learyAI.module.admin.domain.repository.AdminUserReadRepository;
import com.notebook.learyAI.module.auth.infrastructure.persistence.po.UserPO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class AdminUserReadRepositoryImpl implements AdminUserReadRepository {
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public long countAllUsers() {
        Long value = entityManager.createQuery("select count(u.id) from UserPO u", Long.class)
                .getSingleResult();
        return value == null ? 0L : value;
    }

    @Override
    public boolean existsByUserId(long userId) {
        Long value = entityManager.createQuery("select count(u.id) from UserPO u where u.id = :userId", Long.class)
                .setParameter("userId", userId)
                .getSingleResult();
        return value != null && value > 0;
    }

    @Override
    public Optional<AdminUserLoginRow> findByUserId(long userId) {
        List<UserPO> users = entityManager.createQuery(
                        "select u from UserPO u where u.id = :userId",
                        UserPO.class
                )
                .setParameter("userId", userId)
                .setMaxResults(1)
                .getResultList();
        if (users.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(toRow(users.get(0)));
    }

    @Override
    public List<AdminUserLoginRow> listRecentLogins(int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 100));
        return entityManager.createQuery(
                        "select u from UserPO u order by u.lastLoginAt desc, u.id desc",
                        UserPO.class
                )
                .setFirstResult(safePage * safeSize)
                .setMaxResults(safeSize)
                .getResultList()
                .stream()
                .map(this::toRow)
                .toList();
    }

    private AdminUserLoginRow toRow(UserPO po) {
        String userMode = po.getUserMode() == null ? null : po.getUserMode().name();
        return new AdminUserLoginRow(
                po.getId(),
                po.getName(),
                po.getEmail(),
                po.getPhone(),
                userMode,
                po.getLastLoginAt()
        );
    }
}
