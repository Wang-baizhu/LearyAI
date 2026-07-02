// Responsibility: Spring Data JPA repository for KnowledgeBasePO.
package com.notebook.learyAI.module.kb.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.kb.infrastructure.persistence.po.KnowledgeBasePO;
import org.springframework.data.jpa.repository.JpaRepository;

public interface KnowledgeBaseJpaRepository extends JpaRepository<KnowledgeBasePO, Long> {
    boolean existsByNameAndProjectId(String name, java.util.UUID projectId);

    java.util.Optional<KnowledgeBasePO> findByKbIdAndProjectId(java.util.UUID kbId, java.util.UUID projectId);

    java.util.Optional<KnowledgeBasePO> findByKbId(java.util.UUID kbId);

    java.util.Optional<KnowledgeBasePO> findByIdAndProjectId(Long id, java.util.UUID projectId);
}
