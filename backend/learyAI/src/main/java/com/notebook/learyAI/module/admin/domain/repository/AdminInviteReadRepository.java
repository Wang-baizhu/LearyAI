// Responsibility: Define admin read-only invite pagination and detail queries.
package com.notebook.learyAI.module.admin.domain.repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface AdminInviteReadRepository {
    InvitePageResult findInvites(String status,
                                 UUID projectId,
                                 Long creatorUserId,
                                 Instant now,
                                 int page,
                                 int size);

    Optional<InviteRow> findById(long inviteId);

    record InviteRow(long inviteId,
                     UUID projectId,
                     long creatorUserId,
                     String status,
                     Instant expiresAt,
                     int maxUse,
                     int usedCount,
                     Instant createdAt,
                     Instant updatedAt) {
    }

    record InvitePageResult(long total, List<InviteRow> items) {
    }
}
