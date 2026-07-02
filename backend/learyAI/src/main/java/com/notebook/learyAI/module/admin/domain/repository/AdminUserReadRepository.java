// Responsibility: Define admin read-only queries for user summary and recent login list.
package com.notebook.learyAI.module.admin.domain.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface AdminUserReadRepository {
    long countAllUsers();

    boolean existsByUserId(long userId);

    Optional<AdminUserLoginRow> findByUserId(long userId);

    List<AdminUserLoginRow> listRecentLogins(int page, int size);

    record AdminUserLoginRow(long userId,
                             String name,
                             String email,
                             String phone,
                             String userMode,
                             Instant lastLoginAt) {
    }
}
