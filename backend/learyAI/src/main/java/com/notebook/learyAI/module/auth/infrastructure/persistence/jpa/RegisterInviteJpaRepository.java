// Responsibility: Spring Data JPA repository for auth register invites.
package com.notebook.learyAI.module.auth.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;
import com.notebook.learyAI.module.auth.infrastructure.persistence.po.RegisterInvitePO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface RegisterInviteJpaRepository extends JpaRepository<RegisterInvitePO, Long> {
    Optional<RegisterInvitePO> findByCode(String code);

    boolean existsByCode(String code);

    @Modifying
    @Query("""
            update RegisterInvitePO invite
            set invite.status = :usedStatus,
                invite.usedByUserId = :usedByUserId,
                invite.usedAt = :usedAt,
                invite.updatedAt = :usedAt
            where invite.id = :inviteId
              and invite.status = :activeStatus
            """)
    int markUsedIfActive(@Param("inviteId") Long inviteId,
                         @Param("usedByUserId") Long usedByUserId,
                         @Param("usedAt") java.time.Instant usedAt,
                         @Param("activeStatus") RegisterInviteStatus activeStatus,
                         @Param("usedStatus") RegisterInviteStatus usedStatus);

    Page<RegisterInvitePO> findByStatusOrderByCreatedAtDescIdDesc(RegisterInviteStatus status, Pageable pageable);

    Page<RegisterInvitePO> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);
}
