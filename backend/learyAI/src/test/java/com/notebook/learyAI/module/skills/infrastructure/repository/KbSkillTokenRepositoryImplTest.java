// Responsibility: Verify skill token repository maps persisted payload JSON, including legacy claims shape.
package com.notebook.learyAI.module.skills.infrastructure.repository;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.skills.infrastructure.persistence.jpa.SkillTokenJpaRepository;
import com.notebook.learyAI.module.skills.infrastructure.persistence.po.SkillTokenPO;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbSkillTokenRepositoryImplTest {
    @Mock
    private SkillTokenJpaRepository jpaRepository;
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("findByToken: 已废弃的旧 claims 结构 payload 应直接失败")
    void findByToken_shouldRejectLegacyClaimsPayload() {
        KbSkillTokenRepositoryImpl repository = new KbSkillTokenRepositoryImpl(jpaRepository, new ObjectMapper(), jdbcTemplate);
        UUID token = UUID.fromString("4b16c6f3-5fa3-43dd-aa32-939dbe73d31b");
        SkillTokenPO po = new SkillTokenPO();
        po.setId(1L);
        po.setToken(token);
        po.setUserId(9L);
        po.setPayload("""
                {
                  "tokenId": "4b16c6f3-5fa3-43dd-aa32-939dbe73d31b",
                  "projectId": "540c5364-27d6-445c-9b22-9ebd562f726c",
                  "kbId": "e09a7341-259c-42cd-a9fc-faff87e2f065",
                  "userId": 9,
                  "docIds": ["doc-1", "doc-2"],
                  "abilities": ["search"],
                  "issuedAt": "2026-05-06T18:00:00Z",
                  "expiresAt": "2026-05-07T18:00:00Z",
                  "issuer": "backend"
                }
                """);
        po.setExpiredAt(Instant.parse("2026-05-07T18:00:00Z"));
        po.setCreatedAt(Instant.parse("2026-05-06T18:00:00Z"));
        when(jpaRepository.findByToken(token)).thenReturn(Optional.of(po));

        BizException ex = assertThrows(BizException.class, () -> repository.findByToken(token));
        assertEquals("KB_SKILL-500", ex.getCode());
        assertEquals("kb skill token payload deserialize failed", ex.getMessage());
    }

    @Test
    @DisplayName("findByToken: 历史 large object oid payload 应读取真实 JSON")
    void findByToken_shouldReadLargeObjectPayload() {
        KbSkillTokenRepositoryImpl repository = new KbSkillTokenRepositoryImpl(jpaRepository, new ObjectMapper(), jdbcTemplate);
        UUID token = UUID.fromString("4b16c6f3-5fa3-43dd-aa32-939dbe73d31b");
        SkillTokenPO po = new SkillTokenPO();
        po.setId(16L);
        po.setToken(token);
        po.setUserId(1L);
        po.setPayload("141278");
        po.setExpiredAt(null);
        po.setCreatedAt(Instant.parse("2026-05-07T00:25:56.635559Z"));
        when(jpaRepository.findByToken(token)).thenReturn(Optional.of(po));
        when(jdbcTemplate.queryForObject("select convert_from(lo_get(?::oid), 'UTF8')", String.class, 141278L))
                .thenReturn("""
                        {"skillCode":"kb.explorer","abilities":["search"],"projectId":"540c5364-27d6-445c-9b22-9ebd562f726c","kbId":"e09a7341-259c-42cd-a9fc-faff87e2f065","docRefs":[{"name":"Doc A","id":"doc-a"}]}
                        """);

        Optional<KbSkillTokenRecord> result = repository.findByToken(token);

        assertEquals(true, result.isPresent());
        assertEquals("540c5364-27d6-445c-9b22-9ebd562f726c", result.get().getPayload().getProjectId());
        assertEquals("e09a7341-259c-42cd-a9fc-faff87e2f065", result.get().getPayload().getKbId());
        assertEquals(List.of("search"), result.get().getPayload().getAbilities());
        assertEquals(1, result.get().getPayload().getDocRefs().size());
        assertEquals("doc-a", result.get().getPayload().getDocRefs().get(0).get("id"));
        assertEquals("Doc A", result.get().getPayload().getDocRefs().get(0).get("name"));
    }
}
