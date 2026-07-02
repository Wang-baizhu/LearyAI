// Responsibility: Resolve persisted kb skill tokens into validated query context.
package com.notebook.learyAI.module.skills.application;

import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.skills.domain.repository.KbSkillTokenRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

@Service
public class KbSkillTokenResolverAppService {
    private final KbSkillTokenRepository kbSkillTokenRepository;
    private final Clock clock;

    public KbSkillTokenResolverAppService(KbSkillTokenRepository kbSkillTokenRepository) {
        this(kbSkillTokenRepository, Clock.systemUTC());
    }

    @Autowired
    public KbSkillTokenResolverAppService(KbSkillTokenRepository kbSkillTokenRepository, Clock clock) {
        this.kbSkillTokenRepository = kbSkillTokenRepository;
        this.clock = clock;
    }

    public KbSkillTokenRecord resolveActiveToken(String token) {
        KbSkillTokenRecord tokenRecord = kbSkillTokenRepository.findByToken(normalizeToken(token))
                .orElseThrow(() -> new BizException("KB_SKILL-403", "kb skill token invalid"));
        if (tokenRecord.getExpiredAt() != null && !tokenRecord.getExpiredAt().isAfter(Instant.now(clock))) {
            throw new BizException("KB_SKILL-403", "kb skill token expired");
        }
        if (tokenRecord.getUserId() == null || tokenRecord.getUserId() <= 0L) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        KbSkillTokenPayload payload = tokenRecord.getPayload();
        if (payload == null) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        if (isBlank(payload.getProjectId()) || isBlank(payload.getKbId())) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        return tokenRecord;
    }

    private UUID normalizeToken(String token) {
        if (isBlank(token)) {
            throw new BizException("KB_SKILL-400", "token required");
        }
        try {
            return UUID.fromString(token.trim());
        } catch (IllegalArgumentException ex) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
