// Responsibility: Implement kb-doc relation repository using JPA persistence.
package com.notebook.learyAI.module.kbdoc.infrastructure.repository;

import com.notebook.learyAI.module.kbdoc.domain.model.KbDocRelation;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.infrastructure.persistence.jpa.KbDocRelJpaRepository;
import com.notebook.learyAI.module.kbdoc.infrastructure.persistence.po.KbDocRelPO;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@Repository
public class KbDocRelationRepositoryImpl implements KbDocRelationRepository {
    private final KbDocRelJpaRepository jpaRepository;

    public KbDocRelationRepositoryImpl(KbDocRelJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public KbDocRelation save(KbDocRelation relation) {
        KbDocRelPO saved = jpaRepository.save(toPo(relation));
        return toDomain(saved);
    }

    @Override
    public boolean exists(String projectId, Long kbId, Long docId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return false;
        }
        return jpaRepository.existsByProjectIdAndKbIdAndDocId(projectUuid, kbId, docId);
    }

    @Override
    public long countByDocId(String projectId, Long docId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return 0;
        }
        return jpaRepository.countByProjectIdAndDocId(projectUuid, docId);
    }

    @Override
    public List<Long> findDocIdsByKbId(String projectId, Long kbId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return List.of();
        }
        return jpaRepository.findByProjectIdAndKbId(projectUuid, kbId).stream()
                .map(KbDocRelPO::getDocId)
                .collect(Collectors.toList());
    }

    @Override
    public List<Long> findKbIdsByDocId(String projectId, Long docId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return List.of();
        }
        return jpaRepository.findByProjectIdAndDocId(projectUuid, docId).stream()
                .map(KbDocRelPO::getKbId)
                .collect(Collectors.toList());
    }

    @Override
    public void delete(String projectId, Long kbId, Long docId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return;
        }
        jpaRepository.deleteByProjectIdAndKbIdAndDocId(projectUuid, kbId, docId);
    }

    @Override
    public void deleteByKbId(String projectId, Long kbId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return;
        }
        jpaRepository.deleteByProjectIdAndKbId(projectUuid, kbId);
    }

    @Override
    public void deleteByDocId(String projectId, Long docId) {
        java.util.UUID projectUuid = parseUuid(projectId);
        if (projectUuid == null) {
            return;
        }
        jpaRepository.deleteByProjectIdAndDocId(projectUuid, docId);
    }

    private KbDocRelPO toPo(KbDocRelation relation) {
        KbDocRelPO po = new KbDocRelPO();
        po.setId(relation.getId());
        if (relation.getProjectId() != null && !relation.getProjectId().isBlank()) {
            po.setProjectId(java.util.UUID.fromString(relation.getProjectId()));
        }
        po.setKbId(relation.getKbId());
        po.setDocId(relation.getDocId());
        Instant createdAt = relation.getCreatedAt();
        po.setCreatedAt(createdAt == null ? Instant.now() : createdAt);
        return po;
    }

    private KbDocRelation toDomain(KbDocRelPO po) {
        String projectId = po.getProjectId() == null ? null : po.getProjectId().toString();
        return new KbDocRelation(po.getId(), projectId, po.getKbId(), po.getDocId(), po.getCreatedAt());
    }

    private java.util.UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return java.util.UUID.fromString(raw.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
