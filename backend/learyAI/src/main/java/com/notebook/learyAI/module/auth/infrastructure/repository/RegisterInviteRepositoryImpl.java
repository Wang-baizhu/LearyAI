// Responsibility: Implement auth register invite repository using JPA persistence.
package com.notebook.learyAI.module.auth.infrastructure.repository;

import com.notebook.learyAI.module.auth.domain.model.RegisterInvite;
import com.notebook.learyAI.module.auth.domain.model.RegisterInviteStatus;
import com.notebook.learyAI.module.auth.domain.repository.RegisterInviteRepository;
import com.notebook.learyAI.module.auth.infrastructure.persistence.jpa.RegisterInviteJpaRepository;
import com.notebook.learyAI.module.auth.infrastructure.persistence.po.RegisterInvitePO;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class RegisterInviteRepositoryImpl implements RegisterInviteRepository {
    private final RegisterInviteJpaRepository jpaRepository;

    public RegisterInviteRepositoryImpl(RegisterInviteJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public RegisterInvite save(RegisterInvite invite) {
        return toDomain(jpaRepository.save(toPo(invite)));
    }

    @Override
    public boolean markUsedIfActive(Long inviteId, Long usedByUserId, java.time.Instant usedAt) {
        if (inviteId == null || usedByUserId == null || usedAt == null) {
            return false;
        }
        return jpaRepository.markUsedIfActive(
                inviteId,
                usedByUserId,
                usedAt,
                RegisterInviteStatus.ACTIVE,
                RegisterInviteStatus.USED
        ) == 1;
    }

    @Override
    public java.util.Optional<RegisterInvite> findById(Long id) {
        if (id == null) {
            return java.util.Optional.empty();
        }
        return jpaRepository.findById(id).map(this::toDomain);
    }

    @Override
    public java.util.Optional<RegisterInvite> findByCode(String code) {
        if (code == null || code.isBlank()) {
            return java.util.Optional.empty();
        }
        return jpaRepository.findByCode(code.trim()).map(this::toDomain);
    }

    @Override
    public boolean existsByCode(String code) {
        if (code == null || code.isBlank()) {
            return false;
        }
        return jpaRepository.existsByCode(code.trim());
    }

    @Override
    public RegisterInvitePageResult findPage(RegisterInviteStatus status, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 100));
        PageRequest pageable = PageRequest.of(safePage, safeSize);
        Page<RegisterInvitePO> result = status == null
                ? jpaRepository.findAllByOrderByCreatedAtDescIdDesc(pageable)
                : jpaRepository.findByStatusOrderByCreatedAtDescIdDesc(status, pageable);
        return new RegisterInvitePageResult(
                result.getTotalElements(),
                result.getContent().stream().map(this::toRow).toList()
        );
    }

    @Override
    public void deleteById(Long id) {
        if (id == null) {
            return;
        }
        jpaRepository.deleteById(id);
    }

    private RegisterInvitePO toPo(RegisterInvite invite) {
        RegisterInvitePO po = new RegisterInvitePO();
        po.setId(invite.getId());
        po.setCode(invite.getCode());
        po.setStatus(invite.getStatus());
        po.setCreatedBy(invite.getCreatedBy());
        po.setUsedByUserId(invite.getUsedByUserId());
        po.setUsedAt(invite.getUsedAt());
        po.setCreatedAt(invite.getCreatedAt());
        po.setUpdatedAt(invite.getUpdatedAt());
        return po;
    }

    private RegisterInvite toDomain(RegisterInvitePO po) {
        return new RegisterInvite(
                po.getId(),
                po.getCode(),
                po.getStatus(),
                po.getCreatedBy(),
                po.getUsedByUserId(),
                po.getUsedAt(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }

    private RegisterInviteRow toRow(RegisterInvitePO po) {
        return new RegisterInviteRow(
                po.getId(),
                po.getCode(),
                po.getStatus(),
                po.getCreatedBy(),
                po.getUsedByUserId(),
                po.getUsedAt(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }
}
