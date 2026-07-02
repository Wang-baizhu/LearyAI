// Responsibility: Define persistence port for kb skill tokens.
package com.notebook.learyAI.module.skills.domain.repository;

import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;

import java.util.Optional;
import java.util.UUID;

public interface KbSkillTokenRepository {
    KbSkillTokenRecord save(KbSkillTokenRecord record);

    Optional<KbSkillTokenRecord> findByToken(UUID token);

    Optional<KbSkillTokenRecord> findById(Long id);
}
