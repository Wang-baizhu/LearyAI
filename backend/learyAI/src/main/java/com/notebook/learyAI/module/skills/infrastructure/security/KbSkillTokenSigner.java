// Responsibility: Sign kb skill claims into a compact HMAC token.
package com.notebook.learyAI.module.skills.infrastructure.security;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenClaims;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Component
public class KbSkillTokenSigner {
    private static final String VERSION = "v1";
    private static final String ALGORITHM = "HmacSHA256";

    private final ObjectMapper objectMapper;
    private final byte[] secretBytes;
    private final Clock clock;

    public KbSkillTokenSigner(ObjectMapper objectMapper,
                              @Value("${kb.skills.token-secret:dev-only-kb-skills-secret}") String tokenSecret) {
        this(objectMapper, tokenSecret, Clock.systemUTC());
    }

    @Autowired
    public KbSkillTokenSigner(ObjectMapper objectMapper,
                              @Value("${kb.skills.token-secret:dev-only-kb-skills-secret}") String tokenSecret,
                              Clock clock) {
        this.objectMapper = objectMapper;
        if (tokenSecret == null || tokenSecret.isBlank()) {
            throw new BizException("KB_SKILL-500", "kb skill token secret missing");
        }
        this.secretBytes = tokenSecret.getBytes(StandardCharsets.UTF_8);
        this.clock = clock;
    }

    public String sign(KbSkillTokenClaims claims) {
        String payloadJson = toPayloadJson(claims);
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(payloadJson.getBytes(StandardCharsets.UTF_8));
        String signature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(hmacSha256(VERSION + "." + payload));
        return VERSION + "." + payload + "." + signature;
    }

    public KbSkillTokenClaims verify(String token, String requiredAbility) {
        String normalizedToken = requiredText(token, "kb skill token required");
        String[] parts = normalizedToken.split("\\.");
        if (parts.length != 3) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        if (!VERSION.equals(parts[0])) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        String expectedSignature = Base64.getUrlEncoder().withoutPadding()
                .encodeToString(hmacSha256(parts[0] + "." + parts[1]));
        if (!expectedSignature.equals(parts[2])) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        Map<String, Object> payload = readPayload(parts[1]);
        KbSkillTokenClaims claims = toClaims(payload);
        if (!claims.getAbilities().contains(requiredText(requiredAbility, "required ability missing"))) {
            throw new BizException("KB_SKILL-403", "kb skill ability denied");
        }
        if (claims.getExpiresAt() != null && !claims.getExpiresAt().isAfter(Instant.now(clock))) {
            throw new BizException("KB_SKILL-403", "kb skill token expired");
        }
        return claims;
    }

    private String toPayloadJson(KbSkillTokenClaims claims) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("tokenId", claims.getTokenId());
        payload.put("projectId", claims.getProjectId());
        payload.put("kbId", claims.getKbId());
        payload.put("userId", claims.getUserId());
        payload.put("docIds", claims.getDocIds());
        payload.put("abilities", claims.getAbilities());
        payload.put("issuedAt", claims.getIssuedAt() == null ? null : claims.getIssuedAt().toString());
        payload.put("expiresAt", claims.getExpiresAt() == null ? null : claims.getExpiresAt().toString());
        payload.put("issuer", claims.getIssuer());
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            throw new BizException("KB_SKILL-500", "kb skill token serialize failed");
        }
    }

    private byte[] hmacSha256(String value) {
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secretBytes, ALGORITHM));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException ex) {
            throw new BizException("KB_SKILL-500", "kb skill token sign failed");
        }
    }

    private Map<String, Object> readPayload(String payloadBase64) {
        try {
            byte[] payloadBytes = Base64.getUrlDecoder().decode(payloadBase64);
            return objectMapper.readValue(payloadBytes, new TypeReference<Map<String, Object>>() {
            });
        } catch (Exception ex) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
    }

    private KbSkillTokenClaims toClaims(Map<String, Object> payload) {
        String tokenId = requiredText(asText(payload.get("tokenId")), "tokenId invalid");
        String projectId = requiredText(asText(payload.get("projectId")), "projectId invalid");
        String kbId = requiredText(asText(payload.get("kbId")), "kbId invalid");
        Long userId = asLong(payload.get("userId"));
        if (userId == null || userId <= 0L) {
            throw new BizException("KB_SKILL-403", "userId invalid");
        }
        List<String> docIds = asStringList(payload.get("docIds"));
        List<String> abilities = asStringList(payload.get("abilities"));
        String issuer = requiredText(asText(payload.get("issuer")), "issuer invalid");
        Instant issuedAt = parseInstant(payload.get("issuedAt"));
        Instant expiresAt = parseOptionalInstant(payload.get("expiresAt"));
        return new KbSkillTokenClaims(tokenId, projectId, kbId, userId, docIds, abilities, issuedAt, expiresAt, issuer);
    }

    private String requiredText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB_SKILL-403", message);
        }
        return value.trim();
    }

    private String asText(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private Long asLong(Object value) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException ex) {
                return null;
            }
        }
        return null;
    }

    private List<String> asStringList(Object value) {
        if (value == null) {
            return List.of();
        }
        if (!(value instanceof List<?> rawList)) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        return rawList.stream()
                .map(this::asText)
                .map(text -> requiredText(text, "kb skill token invalid"))
                .toList();
    }

    private Instant parseOptionalInstant(Object value) {
        String text = asText(value);
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(text.trim());
        } catch (Exception ex) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
    }

    private Instant parseInstant(Object value) {
        Instant instant = parseOptionalInstant(value);
        if (instant == null) {
            throw new BizException("KB_SKILL-403", "kb skill token invalid");
        }
        return instant;
    }
}
