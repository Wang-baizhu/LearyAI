// Responsibility: Verify phase2 template plugin management service behaviors without plugin version state.
package com.notebook.learyAI.module.template.application;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.auth.domain.model.UserMode;
import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.template.domain.repository.TemplatePluginManifestRepository;
import com.notebook.learyAI.module.template.domain.service.TemplateDomainService;
import com.notebook.learyAI.shared.context.CurrentUserContext;
import com.notebook.learyAI.shared.exception.BizException;
import com.notebook.learyAI.shared.storage.StorageClient;
import com.notebook.learyAI.shared.storage.TemporaryUrl;
import com.notebook.learyAI.shared.storage.UploadPolicy;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplatePluginManagementAppServiceTest {
    private static final String PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";
    private static final String PLUGIN_ID = "123e4567-e89b-12d3-a456-426614174000";
    private static final Long USER_ID = 1001L;

    @Mock
    private TemplatePluginManifestRepository manifestRepository;
    @Mock
    private AuthzSdk authzSdk;
    @Mock
    private StorageClient storageClient;
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskStatusService taskStatusService;
    @Mock
    private TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    private final TemplateDomainService templateDomainService = new TemplateDomainService();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private TemplatePluginManagementAppService appService;

    @BeforeEach
    void setUp() {
        appService = new TemplatePluginManagementAppService(
                manifestRepository,
                templateDomainService,
                authzSdk,
                storageClient,
                taskAppService,
                taskStatusService,
                taskWorkflowOrchestrator,
                objectMapper
        );
    }

    @AfterEach
    void tearDown() {
        CurrentUserContext.clear();
    }

    @Test
    @DisplayName("parseManifest 应提取对象形式 capabilities 与 prompt 字段")
    void parseManifest_shouldExtractFormDefaults() {
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "manifest.json",
                "application/json",
                """
                        {
                          "displayName": "React Example",
                          "entryHtml": "dist/index.html",
                          "assetBaseDir": "dist/assets",
                          "sdkVersion": "phase2",
                          "capabilities": {
                            "render": true,
                            "theme": true,
                            "storage": true
                          },
                          "prompt_json_schema": {
                            "toolPrompt": "tool",
                            "flow_custom_prompt": "flow"
                          },
                          "dataBindings": {
                            "defaultKey": "draft-state"
                          }
                        }
                        """.getBytes(StandardCharsets.UTF_8)
        );

        var result = appService.parseManifest(file);

        assertEquals("React Example", result.normalizedFormValue().get("displayName"));
        assertEquals("phase2", result.normalizedFormValue().get("sdkVersion"));
        assertEquals("tool", ((Map<?, ?>) result.normalizedFormValue().get("promptJsonSchema")).get("toolPrompt"));
        assertEquals("draft-state", ((Map<?, ?>) result.normalizedFormValue().get("dataBindingsJson")).get("defaultKey"));
        assertEquals(true, ((Map<?, ?>) result.normalizedFormValue().get("capabilityJson")).get("render"));
    }

    @Test
    @DisplayName("create 应生成 pluginId 并固定写入 inactive 与 empty")
    void create_shouldGeneratePluginIdAndPersistInactiveEmptyManifest() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);
        when(manifestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TemplatePluginManifest created = appService.create(new TemplatePluginManagementAppService.CreateCommand(
                null,
                PROJECT_ID,
                "react-plugin",
                "React Plugin",
                "phase2",
                "project",
                "project",
                Map.of("toolPrompt", "tool"),
                Map.of("defaultKey", "draft-state"),
                Map.of("render", true),
                Map.of("entryHtml", "dist/index.html")
        ));

        assertNotNull(created.getPluginId());
        assertEquals("inactive", created.getStatus());
        assertEquals("empty", created.getUploadState());
        assertEquals("react-plugin", created.getName());
        assertEquals("React Plugin", created.getDisplayName());
    }

    @Test
    @DisplayName("update 改变可见性时应持久化新可见性")
    void update_shouldPersistVisibilityChange() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest existing = projectManifest("active", "validated", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(existing));
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);
        when(manifestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        TemplatePluginManifest updated = appService.update(
                PLUGIN_ID,
                new TemplatePluginManagementAppService.UpdateCommand(
                        "react-plugin",
                        "React Plugin",
                        "phase2",
                        "project",
                        "public",
                        Map.of("toolPrompt", "tool"),
                        Map.of(),
                        Map.of("render", true)
                )
        );

        assertEquals("public", updated.getVisibility());
    }

    @Test
    @DisplayName("prepareArtifactUpload 应生成无版本 staging key")
    void prepareArtifactUpload_shouldUseVersionlessStagingKey() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest existing = projectManifest("inactive", "empty", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(existing));
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);
        when(storageClient.createUploadPolicy(any(), anyLong(), any())).thenReturn(new UploadPolicy(
                "s3",
                "https://upload.example.com",
                "PUT",
                Map.of(),
                Map.of(),
                Instant.now().plusSeconds(300)
        ));
        when(manifestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var prepared = appService.prepareArtifactUpload(
                PLUGIN_ID,
                new TemplatePluginManagementAppService.PrepareArtifactUploadCommand(128L, "application/zip", false)
        );

        assertEquals("template-plugins-staging/" + PLUGIN_ID + "/dist.zip", prepared.objectKey());
    }

    @Test
    @DisplayName("confirmArtifactUpload 应校验无版本 objectKey 并创建发布任务")
    void confirmArtifactUpload_shouldVerifyVersionlessObjectKeyAndCreatePublishTask() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest existing = projectManifest("inactive", "empty", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(existing));
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);
        when(manifestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(taskAppService.writeJson(any())).thenReturn("{}");
        when(taskAppService.createVisibleTask(
                eq(PROJECT_ID),
                eq("template-plugin-publish"),
                eq(USER_ID),
                eq(TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE),
                eq(PLUGIN_ID),
                eq(TaskStatus.PROCESSING),
                eq("{}"),
                any()
        )).thenReturn(Task.newVisibleTask(
                PROJECT_ID,
                "template-plugin-publish",
                USER_ID,
                "task-1",
                TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE,
                PLUGIN_ID,
                TaskStatus.PROCESSING,
                "{}",
                null,
                null,
                Instant.now()
        ));

        var result = appService.confirmArtifactUpload(
                PLUGIN_ID,
                new TemplatePluginManagementAppService.ConfirmArtifactUploadCommand(
                        "template-plugins-staging/" + PLUGIN_ID + "/dist.zip",
                        256L,
                        "\"etag\"",
                        false
                )
        );

        assertEquals("task-1", result.taskId());
        assertEquals("PROCESSING", result.taskStatus());
        verify(storageClient).verifyObject("template-plugins-staging/" + PLUGIN_ID + "/dist.zip", 256L, "\"etag\"");
        verify(taskWorkflowOrchestrator).startPipeline(any(), any(), eq(USER_ID));
        verify(taskStatusService).publishSnapshot(any(), eq("create"));
    }

    @Test
    @DisplayName("confirmArtifactUpload 遇到中断残留对象时应直接失败且不推进状态")
    void confirmArtifactUpload_shouldRejectInterruptedUploadBeforeCreatingTask() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest existing = projectManifest("inactive", "empty", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(existing));
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);
        doThrow(new BizException("KB-400", "object size mismatch"))
                .when(storageClient).verifyObject(any(), anyLong(), any());

        BizException exception = assertThrows(BizException.class, () -> appService.confirmArtifactUpload(
                PLUGIN_ID,
                new TemplatePluginManagementAppService.ConfirmArtifactUploadCommand(
                        "template-plugins-staging/" + PLUGIN_ID + "/dist.zip",
                        256L,
                        "\"etag\"",
                        false
                )
        ));

        assertEquals("object size mismatch", exception.getMessage());
        verify(manifestRepository, never()).save(any());
        verifyNoInteractions(taskAppService, taskStatusService, taskWorkflowOrchestrator);
    }

    @Test
    @DisplayName("previewEntry 与 authorizePreview 应返回独立预览源地址和回源 URL")
    void preview_shouldUseVersionlessPlatformPreviewPath() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest manifest = projectManifest("active", "validated", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(manifest));
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);
        when(storageClient.createTemporaryUrl(eq("template-plugins/" + PLUGIN_ID + "/dist/assets/main.js"), any()))
                .thenReturn(new TemporaryUrl(
                        "https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/assets/main.js?token=1",
                        Instant.now().plusSeconds(300)
                ));

        var previewEntry = appService.previewEntry(PLUGIN_ID);
        var asset = appService.authorizePreview(PLUGIN_ID, "dist/assets/main.js");

        assertEquals("http://localhost:7999/preview/" + PLUGIN_ID + "/dist/index.html", previewEntry.entryUri());
        assertEquals("asset", asset.cacheMode());
        assertEquals("https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/assets/main.js?token=1",
                asset.originUrl());
        assertEquals("http://localhost:7999/preview/" + PLUGIN_ID + "/dist/assets",
                appService.buildPreviewAssetBaseUri(manifest));
    }

    @Test
    @DisplayName("executePublishValidation 应覆盖上传且最后写入 entryHtml，成功后再清理 staging")
    void executePublishValidation_shouldUploadEntryHtmlLastAndDeleteStagingAfterSuccess() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest manifest = projectManifest("active", "uploaded_pending_validation", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(manifest));
        when(manifestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(storageClient.readObject("template-plugins-staging/" + PLUGIN_ID + "/dist.zip"))
                .thenReturn(zipBytes(Map.of(
                        "manifest.json", """
                                {
                                  "entryHtml": "dist/index.html",
                                  "assetBaseDir": "dist/assets"
                                }
                                """,
                        "dist/index.html", """
                                <html><head><script type="module" src="./assets/main.js"></script></head><body></body></html>
                                """,
                        "dist/assets/main.js", "console.log('ok');"
                )));
        when(storageClient.buildObjectUrl("template-plugins/" + PLUGIN_ID + "/dist/index.html"))
                .thenReturn("https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/index.html");
        when(storageClient.buildObjectUrl("template-plugins/" + PLUGIN_ID + "/dist/assets"))
                .thenReturn("https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/assets");

        var result = appService.executePublishValidation(
                new TemplatePluginManagementAppService.PublishValidationExecutionCommand(
                        PLUGIN_ID,
                        "template-plugins-staging/" + PLUGIN_ID + "/dist.zip"
                )
        );

        assertTrue(result.passed());
        assertEquals("validated", result.result().get("uploadState"));
        InOrder order = inOrder(storageClient);
        order.verify(storageClient).readObject("template-plugins-staging/" + PLUGIN_ID + "/dist.zip");
        order.verify(storageClient).uploadObject(
                eq("template-plugins/" + PLUGIN_ID + "/dist/assets/main.js"),
                any(),
                anyLong(),
                eq("application/javascript")
        );
        order.verify(storageClient).uploadObject(
                eq("template-plugins/" + PLUGIN_ID + "/dist/index.html"),
                any(),
                anyLong(),
                eq("text/html")
        );
        order.verify(storageClient).deletePrefix("template-plugins-staging/" + PLUGIN_ID + "/");
    }

    @Test
    @DisplayName("executePublishValidation 不应把打包 JS 中的普通字符串误判为资源引用")
    void executePublishValidation_shouldIgnoreBundledJavascriptForReferenceScan() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest manifest = projectManifest("inactive", "uploaded_pending_validation", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(manifest));
        when(manifestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(storageClient.readObject("template-plugins-staging/" + PLUGIN_ID + "/dist.zip"))
                .thenReturn(zipBytes(Map.of(
                        "manifest.json", """
                                {
                                  "entryHtml": "dist/index.html",
                                  "assetBaseDir": "dist/assets"
                                }
                                """,
                        "dist/index.html", """
                                <html><head><script type="module" src="./assets/main.js"></script></head><body></body></html>
                                """,
                        "dist/assets/main.js", "const pattern = 'url(https://example.com)'; const html = 'src=\"missing.png\"'; console.log(pattern, html);"
                )));
        when(storageClient.buildObjectUrl("template-plugins/" + PLUGIN_ID + "/dist/index.html"))
                .thenReturn("https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/index.html");
        when(storageClient.buildObjectUrl("template-plugins/" + PLUGIN_ID + "/dist/assets"))
                .thenReturn("https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/assets");

        var result = appService.executePublishValidation(
                new TemplatePluginManagementAppService.PublishValidationExecutionCommand(
                        PLUGIN_ID,
                        "template-plugins-staging/" + PLUGIN_ID + "/dist.zip"
                )
        );

        assertTrue(result.passed());
        assertEquals("active", result.result().get("status"));
        assertEquals("validated", result.result().get("uploadState"));
    }

    @Test
    @DisplayName("executePublishValidation 遇到基础设施异常时应抛出可重试异常")
    void executePublishValidation_shouldThrowRetryableExceptionForInfrastructureFailure() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest manifest = projectManifest("inactive", "uploaded_pending_validation", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(manifest));
        when(manifestRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(storageClient.readObject("template-plugins-staging/" + PLUGIN_ID + "/dist.zip"))
                .thenThrow(new IllegalStateException("storage temporarily unavailable"));

        assertThrows(TemplatePluginManagementAppService.RetryablePublishValidationException.class, () ->
                appService.executePublishValidation(
                        new TemplatePluginManagementAppService.PublishValidationExecutionCommand(
                                PLUGIN_ID,
                                "template-plugins-staging/" + PLUGIN_ID + "/dist.zip"
                        )
                ));
    }

    @Test
    @DisplayName("delete 应删除无版本对象前缀")
    void delete_shouldRemoveVersionlessPrefixes() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest manifest = projectManifest("inactive", "validated", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(manifest));
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);

        appService.delete(PLUGIN_ID);

        verify(manifestRepository).deleteByPluginId(PLUGIN_ID);
        verify(storageClient).deletePrefix("template-plugins/" + PLUGIN_ID + "/");
        verify(storageClient).deletePrefix("template-plugins-staging/" + PLUGIN_ID + "/");
    }

    @Test
    @DisplayName("confirmArtifactUpload 已发布插件在非替换模式下应拒绝重复上传")
    void confirmArtifactUpload_shouldRejectRepublishWithoutReplaceFlag() {
        CurrentUserContext.set(USER_ID, UserMode.FREE);
        TemplatePluginManifest manifest = projectManifest("active", "validated", "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID)).thenReturn(java.util.Optional.of(manifest));
        when(authzSdk.requireRole(eq(USER_ID), eq(PROJECT_ID), any())).thenReturn(ProjectRole.ADMIN);

        BizException exception = assertThrows(BizException.class, () -> appService.confirmArtifactUpload(
                PLUGIN_ID,
                new TemplatePluginManagementAppService.ConfirmArtifactUploadCommand(
                        "template-plugins-staging/" + PLUGIN_ID + "/dist.zip",
                        256L,
                        "\"etag\"",
                        false
                )
        ));

        assertEquals("plugin already published", exception.getMessage());
        verify(storageClient, never()).verifyObject(any(), anyLong(), any());
    }

    private TemplatePluginManifest projectManifest(String status, String uploadState, String visibility) {
        Instant now = Instant.now();
        return new TemplatePluginManifest(
                PLUGIN_ID,
                "react-plugin",
                PROJECT_ID,
                USER_ID,
                "React Plugin",
                "validated".equals(uploadState) || "uploaded_pending_validation".equals(uploadState)
                        ? "https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/index.html"
                        : null,
                "validated".equals(uploadState) || "uploaded_pending_validation".equals(uploadState)
                        ? "https://storage.example.com/template-plugins/" + PLUGIN_ID + "/dist/assets"
                        : null,
                "phase2",
                Map.of("render", true),
                Map.of("toolPrompt", "tool"),
                Map.of(),
                status,
                "project",
                visibility,
                uploadState,
                Map.of("entryHtml", "dist/index.html", "assetBaseDir", "dist/assets"),
                Map.of(),
                now,
                now
        );
    }

    private byte[] zipBytes(Map<String, String> entries) {
        try {
            java.io.ByteArrayOutputStream outputStream = new java.io.ByteArrayOutputStream();
            java.util.zip.ZipOutputStream zipOutputStream = new java.util.zip.ZipOutputStream(outputStream);
            for (Map.Entry<String, String> entry : entries.entrySet()) {
                zipOutputStream.putNextEntry(new java.util.zip.ZipEntry(entry.getKey()));
                zipOutputStream.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
                zipOutputStream.closeEntry();
            }
            zipOutputStream.close();
            return outputStream.toByteArray();
        } catch (java.io.IOException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
