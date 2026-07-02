// Responsibility: Issue kb skill tokens after validating project access and preserving caller scope payload.
package com.notebook.learyAI.module.skills.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.skills.domain.model.KbSkillAbility;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.skills.domain.repository.KbSkillTokenRepository;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillDocRefRequest;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillTokenResponse;
import com.notebook.learyAI.shared.exception.BizException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class KbSkillTokenAppService {
    private static final Logger log = LoggerFactory.getLogger(KbSkillTokenAppService.class);
    private static final int DEFAULT_EXPIRES_IN_DAYS = 1;
    private static final int DEFAULT_EXPIRES_IN_SECONDS = 900;
    private static final int SECONDS_PER_DAY = 24 * 60 * 60;

    private final AuthzSdk authzSdk;
    private final KbSkillTokenRepository kbSkillTokenRepository;
    private final int maxExpiresInDays;
    private final int legacyMaxExpiresInSeconds;
    private final Clock clock;

    public KbSkillTokenAppService(AuthzSdk authzSdk,
                                  KbSkillTokenRepository kbSkillTokenRepository,
                                  @Value("${kb.skills.max-expires-in-days:30}") int maxExpiresInDays,
                                  @Value("${kb.skills.max-expires-in-seconds:1800}") int legacyMaxExpiresInSeconds) {
        this(authzSdk, kbSkillTokenRepository, maxExpiresInDays, legacyMaxExpiresInSeconds, Clock.systemUTC());
    }

    @Autowired
    public KbSkillTokenAppService(AuthzSdk authzSdk,
                                  KbSkillTokenRepository kbSkillTokenRepository,
                                  @Value("${kb.skills.max-expires-in-days:30}") int maxExpiresInDays,
                                  @Value("${kb.skills.max-expires-in-seconds:1800}") int legacyMaxExpiresInSeconds,
                                  Clock clock) {
        this.authzSdk = authzSdk;
        this.kbSkillTokenRepository = kbSkillTokenRepository;
        this.maxExpiresInDays = maxExpiresInDays;
        this.legacyMaxExpiresInSeconds = legacyMaxExpiresInSeconds;
        this.clock = clock;
    }

    public KbSkillTokenResponse createToken(String projectId,
                                            String kbId,
                                            List<KbSkillDocRefRequest> docRefs,
                                            List<String> abilities,
                                            Integer expiresInDays,
                                            Boolean neverExpires,
                                            Integer expiresInSeconds) {
        Long userId = authzSdk.requireUserId();
        String normalizedProjectId = authzSdk.requireProjectId(projectId, "KB_SKILL-400", "KB_SKILL-400", "KB_SKILL-404");
        ensureProjectAccess(userId, normalizedProjectId);
        String normalizedKbId = normalizeRequired(kbId, "kbId");
        List<Map<String, Object>> normalizedDocRefs = normalizeDocRefs(docRefs);
        List<String> normalizedAbilities = normalizeAbilities(abilities);
        Instant issuedAt = Instant.now(clock);
        Instant expiresAt = resolveExpiresAt(issuedAt, expiresInDays, neverExpires, expiresInSeconds);
        KbSkillTokenPayload payload = new KbSkillTokenPayload(
                "kb.explorer",
                normalizedAbilities,
                normalizedProjectId,
                normalizedKbId,
                normalizedDocRefs
        );
        UUID token = UUID.randomUUID();
        KbSkillTokenRecord saved = kbSkillTokenRepository.save(new KbSkillTokenRecord(
                null,
                token,
                userId,
                payload,
                expiresAt,
                issuedAt
        ));
        String expiresAtLog = expiresAt == null ? "permanent" : expiresAt.toString();
        log.info("kb_skill_token_issued tokenId={} userId={} projectId={} kbId={} docScopeSize={} abilities={} expiresAt={}",
                token, userId, normalizedProjectId, normalizedKbId, normalizedDocRefs.size(), normalizedAbilities, expiresAtLog);
        return new KbSkillTokenResponse(
                token.toString(),
                normalizedProjectId,
                normalizedKbId,
                normalizedDocRefs,
                normalizedAbilities,
                saved.getExpiredAt()
        );
    }

    private void ensureProjectAccess(Long userId, String projectId) {
        try {
            authzSdk.requireRole(userId, projectId, Set.of(ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER));
        } catch (BizException ex) {
            if ("PROJECT-403".equals(ex.getCode())) {
                throw new BizException("KB_SKILL-403", "project access denied");
            }
            throw ex;
        }
    }

    private List<Map<String, Object>> normalizeDocRefs(List<KbSkillDocRefRequest> docRefs) {
        if (docRefs == null || docRefs.isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> normalizedDocRefs = new ArrayList<>();
        Set<String> uniqueDocIds = new LinkedHashSet<>();
        for (KbSkillDocRefRequest docRef : docRefs) {
            if (docRef == null) {
                throw new BizException("KB_SKILL-400", "docRef required");
            }
            String normalizedDocId = normalizeRequired(docRef.getId(), "docRef.id");
            String normalizedName = normalizeRequired(docRef.getName(), "docRef.name");
            if (uniqueDocIds.add(normalizedDocId)) {
                normalizedDocRefs.add(buildDocRef(normalizedDocId, normalizedName));
            }
        }
        return List.copyOf(normalizedDocRefs);
    }

    private List<String> normalizeAbilities(List<String> abilities) {
        if (abilities == null || abilities.isEmpty()) {
            throw new BizException("KB_SKILL-400", "abilities required");
        }
        Set<String> uniqueAbilities = new LinkedHashSet<>();
        for (String ability : abilities) {
            uniqueAbilities.add(KbSkillAbility.fromRaw(ability).getClaimValue());
        }
        return new ArrayList<>(uniqueAbilities);
    }

    private Instant resolveExpiresAt(Instant issuedAt,
                                     Integer expiresInDays,
                                     Boolean neverExpires,
                                     Integer expiresInSeconds) {
        if (Boolean.TRUE.equals(neverExpires)) {
            return null;
        }
        if (expiresInDays != null) {
            int requestedDays = resolveExpiresInDays(expiresInDays);
            return issuedAt.plusSeconds((long) requestedDays * SECONDS_PER_DAY);
        }
        int requestedSeconds = expiresInSeconds == null ? DEFAULT_EXPIRES_IN_SECONDS : expiresInSeconds;
        if (requestedSeconds <= 0) {
            throw new BizException("KB_SKILL-400", "expiresInSeconds invalid");
        }
        int configuredMaxSeconds = legacyMaxExpiresInSeconds <= 0 ? DEFAULT_EXPIRES_IN_SECONDS : legacyMaxExpiresInSeconds;
        return issuedAt.plusSeconds(Math.min(requestedSeconds, configuredMaxSeconds));
    }

    private int resolveExpiresInDays(Integer expiresInDays) {
        int requestedDays = expiresInDays == null ? DEFAULT_EXPIRES_IN_DAYS : expiresInDays;
        if (requestedDays <= 0) {
            throw new BizException("KB_SKILL-400", "expiresInDays invalid");
        }
        int configuredMaxDays = maxExpiresInDays <= 0 ? DEFAULT_EXPIRES_IN_DAYS : maxExpiresInDays;
        return Math.min(requestedDays, configuredMaxDays);
    }

    private String normalizeRequired(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB_SKILL-400", field + " required");
        }
        return value.trim();
    }

    private Map<String, Object> buildDocRef(String docId, String name) {
        Map<String, Object> docRef = new HashMap<>();
        docRef.put("id", docId);
        docRef.put("name", (name == null || name.isBlank()) ? null : name.trim());
        return docRef;
    }
}
