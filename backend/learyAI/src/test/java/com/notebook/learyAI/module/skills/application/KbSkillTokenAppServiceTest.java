// Responsibility: Verify kb skill token issuance rules and payload persistence shape.
package com.notebook.learyAI.module.skills.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.skills.domain.repository.KbSkillTokenRepository;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillDocRefRequest;
import com.notebook.learyAI.module.skills.interfaces.dto.KbSkillTokenResponse;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbSkillTokenAppServiceTest {
    @Mock
    private AuthzSdk authzSdk;
    @Mock
    private KbSkillTokenRepository kbSkillTokenRepository;

    @Test
    @DisplayName("createToken: 应返回 uuid token 并原样落库 scope payload")
    void createToken_shouldReturnUuidTokenAndPersistScopePayload() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-05T08:00:00Z"), ZoneOffset.UTC);
        KbSkillTokenAppService appService = new KbSkillTokenAppService(authzSdk, kbSkillTokenRepository, 30, 1800, clock);
        KbSkillDocRefRequest docRef = docRef("ef7d23c56b144b118217507e030a0516", "事故树分析 (FTA) 全面讲解");
        when(authzSdk.requireUserId()).thenReturn(1L);
        when(authzSdk.requireProjectId("540c5364-27d6-445c-9b22-9ebd562f726c", "KB_SKILL-400", "KB_SKILL-400", "KB_SKILL-404"))
                .thenReturn("540c5364-27d6-445c-9b22-9ebd562f726c");
        Instant now = Instant.now(clock);
        when(kbSkillTokenRepository.save(any(KbSkillTokenRecord.class)))
                .thenReturn(new KbSkillTokenRecord(
                        15L,
                        UUID.fromString("8a557f87-7f64-4e58-8414-17df6966f9b5"),
                        1L,
                        new KbSkillTokenPayload(
                                "kb.explorer",
                                List.of("search"),
                                "540c5364-27d6-445c-9b22-9ebd562f726c",
                                "e09a7341-259c-42cd-a9fc-faff87e2f065",
                                List.of(Map.of("id", docRef.getId(), "name", docRef.getName()))
                        ),
                        now.plusSeconds(900),
                        now
                ));

        KbSkillTokenResponse response = appService.createToken(
                "540c5364-27d6-445c-9b22-9ebd562f726c",
                "e09a7341-259c-42cd-a9fc-faff87e2f065",
                List.of(docRef),
                List.of("search"),
                null,
                null,
                900
        );

        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> java.util.UUID.fromString(response.getToken()));
        assertEquals("540c5364-27d6-445c-9b22-9ebd562f726c", response.getProjectId());
        assertEquals("e09a7341-259c-42cd-a9fc-faff87e2f065", response.getKbId());
        assertEquals(List.of(Map.of("id", docRef.getId(), "name", docRef.getName())), response.getDocRefs());
        ArgumentCaptor<KbSkillTokenRecord> recordCaptor = ArgumentCaptor.forClass(KbSkillTokenRecord.class);
        verify(kbSkillTokenRepository).save(recordCaptor.capture());
        List<KbSkillTokenRecord> savedRecords = recordCaptor.getAllValues();
        org.junit.jupiter.api.Assertions.assertDoesNotThrow(() -> java.util.UUID.fromString(savedRecords.get(0).getToken().toString()));
        assertEquals("540c5364-27d6-445c-9b22-9ebd562f726c", savedRecords.get(0).getPayload().getProjectId());
        assertEquals("e09a7341-259c-42cd-a9fc-faff87e2f065", savedRecords.get(0).getPayload().getKbId());
        assertEquals(List.of(Map.of("id", docRef.getId(), "name", docRef.getName())),
                savedRecords.get(0).getPayload().getDocRefs());
        verify(authzSdk).requireRole(eq(1L), eq("540c5364-27d6-445c-9b22-9ebd562f726c"), anySet());
    }

    @Test
    @DisplayName("createToken: 项目无访问权限时应返回 KB_SKILL-403")
    void createToken_whenProjectAccessDenied_shouldThrowKbSkill403() {
        KbSkillTokenAppService appService = new KbSkillTokenAppService(authzSdk, kbSkillTokenRepository, 30, 1800);
        when(authzSdk.requireUserId()).thenReturn(1L);
        when(authzSdk.requireProjectId("p1", "KB_SKILL-400", "KB_SKILL-400", "KB_SKILL-404")).thenReturn("p1");
        doThrow(new BizException("PROJECT-403", "denied"))
                .when(authzSdk).requireRole(eq(1L), eq("p1"), anySet());

        BizException ex = assertThrows(BizException.class, () -> appService.createToken(
                "p1", "kb-1", List.of(), List.of("search"), null, null, 900
        ));

        assertEquals("KB_SKILL-403", ex.getCode());
    }

    private KbSkillDocRefRequest docRef(String id, String name) {
        KbSkillDocRefRequest request = new KbSkillDocRefRequest();
        request.setId(id);
        request.setName(name);
        return request;
    }
}
