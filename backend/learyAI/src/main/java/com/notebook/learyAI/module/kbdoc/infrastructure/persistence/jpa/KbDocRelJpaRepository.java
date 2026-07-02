// Responsibility: Spring Data repository for kb_doc_rel table.
package com.notebook.learyAI.module.kbdoc.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.kbdoc.infrastructure.persistence.po.KbDocRelPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface KbDocRelJpaRepository extends JpaRepository<KbDocRelPO, Long> {
    boolean existsByProjectIdAndKbIdAndDocId(java.util.UUID projectId, Long kbId, Long docId);

    long countByProjectIdAndDocId(java.util.UUID projectId, Long docId);

    List<KbDocRelPO> findByProjectIdAndKbId(java.util.UUID projectId, Long kbId);

    List<KbDocRelPO> findByProjectIdAndDocId(java.util.UUID projectId, Long docId);

    void deleteByProjectIdAndKbIdAndDocId(java.util.UUID projectId, Long kbId, Long docId);

    void deleteByProjectIdAndKbId(java.util.UUID projectId, Long kbId);

    void deleteByProjectIdAndDocId(java.util.UUID projectId, Long docId);
}
