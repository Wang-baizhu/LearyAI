// Responsibility: Spring Data repository for kb_doc table.
package com.notebook.learyAI.module.kbdoc.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.kbdoc.infrastructure.persistence.po.KbDocPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface KbDocJpaRepository extends JpaRepository<KbDocPO, Long> {
    Optional<KbDocPO> findByDocIdAndProjectId(String docId, java.util.UUID projectId);

    Optional<KbDocPO> findByDocId(String docId);

    boolean existsByDocIdAndProjectId(String docId, java.util.UUID projectId);

    Optional<KbDocPO> findByIdAndProjectId(Long id, java.util.UUID projectId);

    void deleteByDocIdAndProjectId(String docId, java.util.UUID projectId);
}
