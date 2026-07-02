// Responsibility: Verify runtime template plugin registry accessibility rules.
package com.notebook.learyAI.module.template.application;

import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.template.domain.repository.TemplatePluginManifestRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TemplatePluginRegistryTest {
    private static final String PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";
    private static final String OTHER_PROJECT_ID = "650e8400-e29b-41d4-a716-446655440000";
    private static final String PLUGIN_ID = "22222222-2222-2222-2222-222222222222";
    private static final Long USER_ID = 7L;

    @Mock
    private TemplatePluginManifestRepository manifestRepository;
    @Mock
    private AuthzSdk authzSdk;

    @InjectMocks
    private TemplatePluginRegistry registry;

    @Test
    @DisplayName("requirePluginById 应允许解析 public 插件")
    void requirePluginById_shouldAllowCrossProjectPublicPlugin() {
        TemplatePluginManifest manifest = manifest(OTHER_PROJECT_ID, "public");
        when(manifestRepository.findByPluginId(PLUGIN_ID))
                .thenReturn(Optional.of(manifest));

        TemplatePluginManifest result = registry.requirePluginById(USER_ID, PROJECT_ID, PLUGIN_ID);

        assertSame(manifest, result);
        verify(manifestRepository).findByPluginId(PLUGIN_ID);
        verify(authzSdk, never()).isMember(USER_ID, OTHER_PROJECT_ID);
    }

    @Test
    @DisplayName("requirePluginById 应仅允许 owner 访问 private 插件")
    void requirePluginById_shouldAllowPrivatePluginForOwnerOnly() {
        TemplatePluginManifest manifest = manifest(OTHER_PROJECT_ID, "private");
        when(manifestRepository.findByPluginId(PLUGIN_ID))
                .thenReturn(Optional.of(manifest));

        TemplatePluginManifest result = registry.requirePluginById(1L, PROJECT_ID, PLUGIN_ID);

        assertSame(manifest, result);
    }

    @Test
    @DisplayName("requirePluginById 应允许项目成员访问 project 插件")
    void requirePluginById_shouldAllowProjectPluginForMember() {
        TemplatePluginManifest manifest = manifest(OTHER_PROJECT_ID, "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID))
                .thenReturn(Optional.of(manifest));
        when(authzSdk.isMember(USER_ID, OTHER_PROJECT_ID)).thenReturn(true);

        TemplatePluginManifest result = registry.requirePluginById(USER_ID, PROJECT_ID, PLUGIN_ID);

        assertSame(manifest, result);
        verify(authzSdk).isMember(USER_ID, OTHER_PROJECT_ID);
    }

    @Test
    @DisplayName("requirePluginById 在运行时不可访问时应抛出 pluginId invalid")
    void requirePluginById_shouldRejectInaccessiblePlugin() {
        TemplatePluginManifest manifest = manifest(OTHER_PROJECT_ID, "project");
        when(manifestRepository.findByPluginId(PLUGIN_ID))
                .thenReturn(Optional.of(manifest));
        when(authzSdk.isMember(USER_ID, OTHER_PROJECT_ID)).thenReturn(false);

        BizException exception = assertThrows(BizException.class,
                () -> registry.requirePluginById(USER_ID, PROJECT_ID, PLUGIN_ID));

        assertEquals("TEMPLATE-400", exception.getCode());
        assertEquals("pluginId invalid", exception.getMessage());
    }

    private TemplatePluginManifest manifest(String projectId, String visibility) {
        Instant now = Instant.now();
        return new TemplatePluginManifest(
                PLUGIN_ID,
                "quiz",
                projectId,
                1L,
                "题目",
                "/plugins/quiz/index.html",
                null,
                "phase2",
                Map.of(),
                Map.of(),
                Map.of(),
                "active",
                "project",
                visibility,
                "validated",
                Map.of(),
                Map.of(),
                now,
                now
        );
    }
}
