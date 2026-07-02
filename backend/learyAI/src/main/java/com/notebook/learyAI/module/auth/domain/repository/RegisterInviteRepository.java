// Responsibility: Persist auth register invites and related admin query views.
package com.notebook.learyAI.module.auth.domain.repository;

import com.notebook.learyAI.module.auth.domain.model.RegisterInvite;
import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface RegisterInviteRepository {
    RegisterInvite save(RegisterInvite invite);

    boolean markUsedIfActive(Long inviteId, Long usedByUserId, Instant usedAt);

    Optional<RegisterInvite> findById(Long id);

    Optional<RegisterInvite> findByCode(String code);

    boolean existsByCode(String code);

    RegisterInvitePageResult findPage(RegisterInviteStatus status, int page, int size);

    void deleteById(Long id);

    record RegisterInvitePageResult(long total, List<RegisterInviteRow> items) {
    }

    record RegisterInviteRow(Long inviteId,
                             String code,
                             RegisterInviteStatus status,
                             Long createdBy,
                             Long usedByUserId,
                             Instant usedAt,
                             Instant createdAt,
                             Instant updatedAt) {
    }
}
