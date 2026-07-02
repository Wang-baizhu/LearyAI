// Responsibility: Verify kb-doc bind/unbind owner-only authorization with real PostgreSQL membership/authz data.
package com.notebook.learyAI.module.kbdoc.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.authz.application.AuthzSdkImpl;
import com.notebook.learyAI.module.authz.application.cache.AuthzQueryCache;
import com.notebook.learyAI.module.authz.application.cache.CachedValue;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.domain.repository.MembershipQueryRepository;
import com.notebook.learyAI.module.authz.domain.service.AuthzPolicyService;
import com.notebook.learyAI.module.kb.application.KnowledgeBaseAccessSupport;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBase;
import com.notebook.learyAI.module.kb.domain.model.KnowledgeBaseVisibility;
import com.notebook.learyAI.module.kb.domain.repository.KnowledgeBaseRepository;
import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDoc;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocOption;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocPage;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocRelation;
import com.notebook.learyAI.module.kbdoc.domain.model.KbDocTextChunkPage;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRelationRepository;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.usage.interfaces.sdk.UsageFactRecorder;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.storage.StsCredentials;
import com.notebook.learyAI.shared.storage.TemporaryUrl;
import com.notebook.learyAI.shared.storage.TemporaryUrlPurpose;
import com.notebook.learyAI.shared.storage.UploadPolicy;
import com.notebook.learyAI.module.project.domain.model.Project;
import com.notebook.learyAI.module.project.domain.model.ProjectMember;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberRole;
import com.notebook.learyAI.module.project.domain.model.ProjectMemberStatus;
import com.notebook.learyAI.module.project.domain.repository.ProjectMemberRepository;
import com.notebook.learyAI.module.project.domain.repository.ProjectRepository;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.InputStream;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class KbDocOwnerOnlyIntegrationTest extends AbstractPgRedisIntegrationTest {

    @Autowired
    private ProjectRepository projectRepository;
    @Autowired
    private ProjectMemberRepository projectMemberRepository;
    @Autowired
    private KnowledgeBaseRepository knowledgeBaseRepository;
    @Autowired
    private KbDocRepository kbDocRepository;
    @Autowired
    private KbDocRelationRepository kbDocRelationRepository;
    @Autowired
    private MembershipQueryRepository membershipQueryRepository;
    @Autowired
    private AuthzPolicyService authzPolicyService;
    @Autowired
    private JdbcTemplate jdbcTemplate;
    @Autowired
    private PlatformTransactionManager transactionManager;

    private KbDocBindingAppService kbDocBindingAppService;
    private KbDocStorageUsageAppService kbDocStorageUsageAppService;
    private TransactionTemplate transactionTemplate;
    private String testProjectId;
    private long ownerUserId;
    private long memberUserId;
    private String testKbId;
    private String testDocId;
    private Long kbInternalId;
    private Long docInternalId;

    @BeforeEach
    void setUp() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        testProjectId = "550e8400-e29b-41d4-a716-" + String.format("%012d", caseId % 1_000_000_000_000L);
        ownerUserId = caseId;
        memberUserId = caseId + 1;
        testKbId = UUID.randomUUID().toString();
        testDocId = "doc-" + caseId;

        AuthzSdkImpl authzSdk = new AuthzSdkImpl(membershipQueryRepository, authzPolicyService, new NoopAuthzQueryCache());
        KnowledgeBaseAccessSupport knowledgeBaseAccessSupport = new KnowledgeBaseAccessSupport(authzSdk);
        StorageClient storageClient = new NoopStorageClient();
        kbDocStorageUsageAppService = new KbDocStorageUsageAppService(mock(UsageFactRecorder.class));
        KbDocAppSupport support = new KbDocAppSupport(
                kbDocRepository,
                kbDocRelationRepository,
                knowledgeBaseRepository,
                knowledgeBaseAccessSupport,
                storageClient,
                new ObjectMapper(),
                authzSdk,
                "minio-stub"
        );
        kbDocBindingAppService = new KbDocBindingAppService(
                kbDocRepository,
                kbDocRelationRepository,
                storageClient,
                kbDocStorageUsageAppService,
                support,
                new NoopKbDocQueryCache()
        );
        transactionTemplate = new TransactionTemplate(transactionManager);

        Instant now = Instant.now();
        projectRepository.save(new Project(testProjectId, "p-kbdoc-auth", ownerUserId, now, now));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, ownerUserId, ProjectMemberRole.OWNER, ProjectMemberStatus.ACTIVE, now, now
        ));
        projectMemberRepository.save(new ProjectMember(
                null, testProjectId, memberUserId, ProjectMemberRole.MEMBER, ProjectMemberStatus.ACTIVE, now, now
        ));

        KnowledgeBase kb = knowledgeBaseRepository.save(new KnowledgeBase(
                null, testKbId, testProjectId, "kb", "desc", List.of("tag"), ownerUserId, KnowledgeBaseVisibility.PRIVATE, null
        ));
        kbInternalId = kb.getId();
        KbDoc doc = kbDocRepository.save(new KbDoc(
                null, testProjectId, testDocId, "doc", "txt", 128L, "obj/" + testDocId + "/file.txt", "minio", null,
                null, "DONE", now, now
        ));
        docInternalId = doc.getId();
    }

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
        jdbcTemplate.update("delete from kb_doc_rel where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from kb_doc where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from knowledge_base where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from project_member where project_id = cast(? as uuid)", testProjectId);
        jdbcTemplate.update("delete from project where id = cast(? as uuid)", testProjectId);
    }

    @Test
    @DisplayName("MEMBER bindDoc 应返回 KB-403")
    void bindDoc_asMember_shouldThrowKb403() {
        runAs(memberUserId);

        BizException ex = assertThrows(BizException.class,
                () -> kbDocBindingAppService.bindDoc(testProjectId, testDocId, testKbId));
        assertEquals("KB-403", ex.getCode());
    }

    @Test
    @DisplayName("OWNER bindDoc 应成功写入 relation")
    void bindDoc_asOwner_shouldSucceed() {
        runAs(ownerUserId);
        kbDocBindingAppService.bindDoc(testProjectId, testDocId, testKbId);

        assertTrue(kbDocRelationRepository.exists(testProjectId, kbInternalId, docInternalId));
    }

    @Test
    @DisplayName("MEMBER unbindDoc 应返回 KB-403")
    void unbindDoc_asMember_shouldThrowKb403() {
        kbDocRelationRepository.save(new KbDocRelation(null, testProjectId, kbInternalId, docInternalId, Instant.now()));
        runAs(memberUserId);

        BizException ex = assertThrows(BizException.class,
                () -> kbDocBindingAppService.unbindDoc(testProjectId, testDocId, testKbId));
        assertEquals("KB-403", ex.getCode());
    }

    @Test
    @DisplayName("OWNER unbindDoc 后关系和文档应被清理")
    void unbindDoc_asOwner_shouldDeleteRelationAndDoc() {
        kbDocRelationRepository.save(new KbDocRelation(null, testProjectId, kbInternalId, docInternalId, Instant.now()));
        kbDocStorageUsageAppService.recordUploadConfirmed(
                ownerUserId,
                testProjectId,
                testDocId,
                "obj/" + testDocId + "/file.txt",
                128L,
                null
        );
        runAs(ownerUserId);
        transactionTemplate.executeWithoutResult(
                status -> kbDocBindingAppService.unbindDoc(testProjectId, testDocId, testKbId)
        );

        assertTrue(kbDocRelationRepository.countByDocId(testProjectId, docInternalId) == 0);
        assertTrue(kbDocRepository.findByDocId(testDocId, testProjectId).isEmpty());
    }

    private void runAs(long userId) {
        CurrentUserContext.set(userId, UserMode.FREE);
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

    private static class NoopKbDocQueryCache implements KbDocQueryCache {
        @Override
        public com.notebook.learyAI.module.kbdoc.application.cache.CachedValue<KbDocPage> getList(
                String projectId, long userId, String search, String fileType, int page, int size, String kbId) {
            return com.notebook.learyAI.module.kbdoc.application.cache.CachedValue.miss();
        }

        @Override
        public void putList(String projectId, long userId, String search, String fileType, int page, int size,
                            String kbId, KbDocPage pageResult) {
        }

        @Override
        public com.notebook.learyAI.module.kbdoc.application.cache.CachedValue<List<KbDocOption>> getDocOptions(
                String projectId, long userId, String search, String kbId) {
            return com.notebook.learyAI.module.kbdoc.application.cache.CachedValue.miss();
        }

        @Override
        public void putDocOptions(String projectId, long userId, String search, String kbId, List<KbDocOption> options) {
        }

        @Override
        public com.notebook.learyAI.module.kbdoc.application.cache.CachedValue<KbDoc> getDetail(
                String projectId, String docId, long userId) {
            return com.notebook.learyAI.module.kbdoc.application.cache.CachedValue.miss();
        }

        @Override
        public void putDetail(String projectId, String docId, long userId, KbDoc doc) {
        }

        @Override
        public com.notebook.learyAI.module.kbdoc.application.cache.CachedValue<KbDocTextChunkPage> getChunks(
                String projectId, String docId, int startChunkSec, int size, long userId) {
            return com.notebook.learyAI.module.kbdoc.application.cache.CachedValue.miss();
        }

        @Override
        public void putChunks(String projectId, String docId, int startChunkSec, int size, long userId,
                              KbDocTextChunkPage chunks) {
        }

        @Override
        public com.notebook.learyAI.module.kbdoc.application.cache.CachedValue<List<String>> getRecentIds(
                String projectId, int limit, long userId) {
            return com.notebook.learyAI.module.kbdoc.application.cache.CachedValue.miss();
        }

        @Override
        public void putRecentIds(String projectId, int limit, long userId, List<String> docIds) {
        }

        @Override
        public void evictProject(String projectId) {
        }

        @Override
        public void evictDoc(String projectId, long docInternalId, String docId) {
        }

        @Override
        public void evictDocByDocId(String projectId, String docId) {
        }
    }

    private static class NoopStorageClient implements StorageClient {
        @Override
        public UploadPolicy createUploadPolicy(String objectKey, long size, String contentType) {
            return null;
        }

        @Override
        public void verifyObject(String objectKey, Long size, String etag) {
        }

        @Override
        public void uploadObject(String objectKey, InputStream inputStream, long size, String contentType) {
        }

        @Override
        public byte[] readObject(String objectKey) {
            return new byte[0];
        }

        @Override
        public TemporaryUrl createTemporaryUrl(String objectKey,
                                               TemporaryUrlPurpose purpose) {
            return null;
        }

        @Override
        public StsCredentials issueStsCredentials(String prefix, long durationSeconds) {
            return null;
        }

        @Override
        public String buildObjectUrl(String objectKey) {
            return null;
        }

        @Override
        public void deletePrefix(String prefix) {
        }
    }
}
