// Responsibility: Verify knowledge base visibility behavior with real repository and authz integration.
package com.notebook.learyAI.module.kb.application;

import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.authz.application.AuthzSdkImpl;
import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.application.cache.CachedValue;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import com.notebook.learyAI.module.kb.application.cache.KnowledgeBaseQueryCache;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBasePage;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseSort;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kb.domain.service.KnowledgeBaseDomainService;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.module.visit.application.UserResourceVisitAppService;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class KnowledgeBaseVisibilityIntegrationTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private KnowledgeBaseRepository knowledgeBaseRepository;
    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private ProjectMemberRepository projectMemberRepository;
    @Autowired
    private MembershipQueryRepository membershipQueryRepository;
    @Autowired
    private AuthzPolicyService authzPolicyService;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private KnowledgeBaseAppService knowledgeBaseAppService;
    private String testProjectId;
    private long ownerUserId;
    private long memberUserId;
    private long outsiderUserId;
    private String publicKbId;
    private String teamKbId;
    private String privateKbId;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);
        ownerUserId = caseId;
        memberUserId = caseId + 1;
        outsiderUserId = caseId + 2;

        AuthzSdkImpl authzSdk = new AuthzSdkImpl(
                membershipQueryRepository,
                authzPolicyService,
                new NoopAuthzQueryCache()
        );
        KnowledgeBaseAccessSupport accessSupport = new KnowledgeBaseAccessSupport(authzSdk);

        KbDocRelationRepository relationRepository = mock(KbDocRelationRepository.class);
        KbDocRepository docRepository = mock(KbDocRepository.class);
        UserResourceVisitAppService visitAppService = mock(UserResourceVisitAppService.class);
        knowledgeBaseAppService = new KnowledgeBaseAppService(
                knowledgeBaseRepository,
                relationRepository,
                docRepository,
                visitAppService,
                accessSupport,
                new KnowledgeBaseDomainService(),
                authzSdk,
                new NoopKnowledgeBaseQueryCache()
        );

        Instant now = Instant.now();
        projectRepository.save(new Project(testProjectId, "p-kb-visibility", ownerUserId, now, now));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, ownerUserId, ProjectMemberRole.OWNER, ProjectMemberStatus.ACTIVE, now, now
        ));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, memberUserId, ProjectMemberRole.MEMBER, ProjectMemberStatus.ACTIVE, now, now
        ));

        publicKbId = saveKb("kb-public", KnowledgeBaseVisibility.PUBLIC, ownerUserId);
        teamKbId = saveKb("kb-team", KnowledgeBaseVisibility.TEAM, ownerUserId);
        privateKbId = saveKb("kb-private", KnowledgeBaseVisibility.PRIVATE, ownerUserId);
    }

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
        jdbcTemplate.update("delete from knowledge_base where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from project_member where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from project where id = cast(? as uuid)", testProjectId);
    }

    @Test
    @DisplayName("非成员 list 仅应看到 PUBLIC")
    void list_forOutsider_shouldOnlySeePublic() {
        runAs(outsiderUserId);
        KnowledgeBasePage page = knowledgeBaseAppService.list(testProjectId, null, null, "name", "asc", 1, 20);
        List<String> ids = page.getItems().stream().map(KnowledgeBase::getKbId).collect(Collectors.toList());

        assertEquals(1, ids.size());
        assertTrue(ids.contains(publicKbId));
    }

    @Test
    @DisplayName("成员 list 应看到 PUBLIC + TEAM")
    void list_forMember_shouldSeePublicAndTeam() {
        runAs(memberUserId);
        KnowledgeBasePage page = knowledgeBaseAppService.list(testProjectId, null, null, "name", "asc", 1, 20);
        Set<String> ids = page.getItems().stream().map(KnowledgeBase::getKbId).collect(Collectors.toSet());

        assertEquals(Set.of(publicKbId, teamKbId), ids);
    }

    @Test
    @DisplayName("owner list 应看到 PUBLIC + TEAM + PRIVATE")
    void list_forOwner_shouldSeeAll() {
        runAs(ownerUserId);
        KnowledgeBasePage page = knowledgeBaseAppService.list(testProjectId, null, null, "name", "asc", 1, 20);
        Set<String> ids = page.getItems().stream().map(KnowledgeBase::getKbId).collect(Collectors.toSet());

        assertEquals(Set.of(publicKbId, teamKbId, privateKbId), ids);
    }

    @Test
    @DisplayName("PRIVATE 知识库仅 owner 可读")
    void detail_private_shouldAllowOwnerOnly() {
        runAs(ownerUserId);
        KnowledgeBase ownerRead = knowledgeBaseAppService.getByKbId(testProjectId, privateKbId);
        assertEquals(privateKbId, ownerRead.getKbId());

        runAs(memberUserId);
        BizException ex = assertThrows(BizException.class,
                () -> knowledgeBaseAppService.getByKbId(testProjectId, privateKbId));
        assertEquals("KB-404", ex.getCode());
    }

    @Test
    @DisplayName("TEAM 知识库应拒绝非成员读取")
    void detail_team_shouldDenyOutsider() {
        runAs(outsiderUserId);
        BizException ex = assertThrows(BizException.class,
                () -> knowledgeBaseAppService.getByKbId(testProjectId, teamKbId));
        assertEquals("KB-404", ex.getCode());
    }

    private void runAs(long userId) {
        CurrentUserContext.set(userId, UserMode.FREE);
    }

    private String saveKb(String name, KnowledgeBaseVisibility visibility, long ownerId) {
        KnowledgeBase saved = knowledgeBaseRepository.save(new KnowledgeBase(
                null,
                UUID.randomUUID().toString(),
                testProjectId,
                name,
                "desc",
                List.of("tag"),
                ownerId,
                visibility,
                null
        ));
        return saved.getKbId();
    }

    private static class NoopAuthzQueryCache implements AuthzQueryCache {
        @Override
        public CachedValue<Boolean> getProjectExists(String projectId) {
            return CachedValue.miss();
        }

        @Override
        public void putProjectExists(String projectId, boolean exists) {
        }

        @Override
        public CachedValue<ProjectRole> getRole(String projectId, long userId) {
            return CachedValue.miss();
        }

        @Override
        public void putRole(String projectId, long userId, ProjectRole role) {
        }

        @Override
        public void evictProjectExists(String projectId) {
        }

        @Override
        public void evictRole(String projectId, long userId) {
        }

        @Override
        public void evictRoles(String projectId, java.util.Collection<Long> userIds) {
        }

        @Override
        public void evictRoleByProject(String projectId) {
        }
    }

    private static class NoopKnowledgeBaseQueryCache implements KnowledgeBaseQueryCache {
        @Override
        public com.notebook.learyAI.module.kb.application.cache.CachedValue<KnowledgeBasePage> getList(
                String projectId, long userId, boolean isMember, String search, String tag, KnowledgeBaseSort sort,
                boolean desc, int page, int size) {
            return com.notebook.learyAI.module.kb.application.cache.CachedValue.miss();
        }

        @Override
        public void putList(String projectId, long userId, boolean isMember, String search, String tag,
                            KnowledgeBaseSort sort, boolean desc, int page, int size, KnowledgeBasePage pageResult) {
        }

        @Override
        public com.notebook.learyAI.module.kb.application.cache.CachedValue<List<KnowledgeBase>> getRecent(
                String projectId, long userId, int limit) {
            return com.notebook.learyAI.module.kb.application.cache.CachedValue.miss();
        }

        @Override
        public void putRecent(String projectId, long userId, int limit, List<KnowledgeBase> items) {
        }

        @Override
        public com.notebook.learyAI.module.kb.application.cache.CachedValue<KnowledgeBase> getDetail(
                String projectId, String kbId, long userId) {
            return com.notebook.learyAI.module.kb.application.cache.CachedValue.miss();
        }

        @Override
        public void putDetail(String projectId, String kbId, long userId, KnowledgeBase knowledgeBase) {
        }

        @Override
        public void evictByProject(String projectId) {
        }

        @Override
        public void evictRecent(String projectId, long userId) {
        }

        @Override
        public void evictDetail(String projectId, String kbId) {
        }
    }
}
