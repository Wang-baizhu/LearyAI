// Responsibility: Provide JPA access to persisted external skill tokens.
package com.notebook.learyAI.module.skills.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.skills.infrastructure.persistence.po.SkillTokenPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface SkillTokenJpaRepository extends JpaRepository<SkillTokenPO, Long> {
    Optional<SkillTokenPO> findByToken(UUID token);
}
