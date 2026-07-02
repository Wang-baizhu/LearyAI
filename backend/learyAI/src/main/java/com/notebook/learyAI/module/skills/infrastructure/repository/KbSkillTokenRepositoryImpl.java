// Responsibility: Persist and restore kb skill tokens with payload JSON.
package com.notebook.learyAI.module.skills.infrastructure.repository;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.skills.domain.repository.KbSkillTokenRepository;
import com.notebook.learyAI.module.skills.infrastructure.persistence.jpa.SkillTokenJpaRepository;
import com.notebook.learyAI.module.skills.infrastructure.persistence.po.SkillTokenPO;
import com.notebook.learyAI.shared.exception.BizException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public class KbSkillTokenRepositoryImpl implements KbSkillTokenRepository {
    private static final Logger log = LoggerFactory.getLogger(KbSkillTokenRepositoryImpl.class);

    private final SkillTokenJpaRepository jpaRepository;
    private final ObjectMapper objectMapper;
    private final JdbcTemplate jdbcTemplate;

    public KbSkillTokenRepositoryImpl(SkillTokenJpaRepository jpaRepository,
                                      ObjectMapper objectMapper,
                                      JdbcTemplate jdbcTemplate) {
        this.jpaRepository = jpaRepository;
        this.objectMapper = objectMapper;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public KbSkillTokenRecord save(KbSkillTokenRecord record) {
        SkillTokenPO saved = jpaRepository.save(toPo(record));
        return toDomain(saved);
    }

    @Override
    public Optional<KbSkillTokenRecord> findByToken(UUID token) {
        if (token == null) {
            return Optional.empty();
        }
        return jpaRepository.findByToken(token).map(this::toDomain);
    }

    @Override
    public Optional<KbSkillTokenRecord> findById(Long id) {
        if (id == null || id <= 0L) {
            return Optional.empty();
        }
        return jpaRepository.findById(id).map(this::toDomain);
    }

    private SkillTokenPO toPo(KbSkillTokenRecord record) {
        SkillTokenPO po = new SkillTokenPO();
        po.setId(record.getId());
        if (record.getToken() == null) {
            throw new BizException("KB_SKILL-500", "kb skill token required");
        }
        po.setToken(record.getToken());
        Long userId = record.getUserId();
        if (userId == null || userId <= 0L) {
            throw new BizException("KB_SKILL-500", "kb skill token userId invalid");
        }
        po.setUserId(userId);
        po.setPayload(writePayload(record.getPayload()));
        po.setExpiredAt(record.getExpiredAt());
        po.setCreatedAt(record.getCreatedAt() == null ? Instant.now() : record.getCreatedAt());
        return po;
    }

    private KbSkillTokenRecord toDomain(SkillTokenPO po) {
        return new KbSkillTokenRecord(
                po.getId(),
                po.getToken(),
                po.getUserId(),
                readPayload(po.getPayload()),
                po.getExpiredAt(),
                po.getCreatedAt()
        );
    }

    private String writePayload(KbSkillTokenPayload payload) {
        if (payload == null) {
            throw new BizException("KB_SKILL-500", "kb skill token payload missing");
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new BizException("KB_SKILL-500", "kb skill token payload serialize failed");
        }
    }

    private KbSkillTokenPayload readPayload(String payloadRaw) {
        String normalizedPayload = requiredText(payloadRaw, "kb skill token payload missing");
        String actualPayload = isLargeObjectOid(normalizedPayload)
                ? readLargeObjectPayload(normalizedPayload)
                : normalizedPayload;
        try {
            return objectMapper.readValue(actualPayload, KbSkillTokenPayload.class);
        } catch (IOException ex) {
            log.error("kb skill token payload deserialize failed payload={}", abbreviate(actualPayload), ex);
            throw new BizException("KB_SKILL-500", "kb skill token payload deserialize failed");
        }
    }

    private boolean isLargeObjectOid(String payloadRaw) {
        return payloadRaw.chars().allMatch(Character::isDigit);
    }

    private String readLargeObjectPayload(String oidText) {
        Long oid;
        try {
            oid = Long.parseLong(oidText);
        } catch (NumberFormatException ex) {
            throw new BizException("KB_SKILL-500", "kb skill token payload deserialize failed");
        }
        try {
            String payload = jdbcTemplate.queryForObject(
                    "select convert_from(lo_get(?::oid), 'UTF8')",
                    String.class,
                    oid
            );
            return requiredText(payload, "kb skill token payload missing");
        } catch (Exception ex) {
            log.error("kb skill token payload large object read failed oid={}", oid, ex);
            throw new BizException("KB_SKILL-500", "kb skill token payload deserialize failed");
        }
    }

    private String requiredText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB_SKILL-500", message);
        }
        return value.trim();
    }

    private String abbreviate(String value) {
        if (value == null) {
            return null;
        }
        if (value.length() <= 512) {
            return value;
        }
        return value.substring(0, 512) + "...";
    }
}
