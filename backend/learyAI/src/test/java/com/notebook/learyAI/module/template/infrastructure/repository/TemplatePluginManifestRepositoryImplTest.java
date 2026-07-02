// Responsibility: Verify persisted template plugin manifest lookup against the real PostgreSQL registry table.
package com.notebook.learyAI.module.template.infrastructure.repository;

import com.notebook.learyAI.module.template.domain.model.TemplatePluginManifest;
import com.notebook.learyAI.module.template.domain.repository.TemplatePluginManifestRepository;
import com.notebook.learyAI.shared.AbstractPgRedisIntegrationTest;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TemplatePluginManifestRepositoryImplTest extends AbstractPgRedisIntegrationTest {
    private static final String QUIZ_PLUGIN_ID = "22222222-2222-2222-2222-222222222222";

    @Autowired
    private TemplatePluginManifestRepository manifestRepository;
    @Autowired
    private JdbcTemplate jdbcTemplate;

    private String testPluginId;

    @AfterEach
    void tearDown() {
        if (testPluginId != null) {
            jdbcTemplate.update("delete from template_plugin_manifest where plugin_id = cast(? as uuid)", testPluginId);
        }
    }

    @Test
    @DisplayName("平台级外部插件应从真实表读取")
    void findActiveByProjectIdOrGlobal_shouldLoadGlobalManifest() {
        String globalPluginId = UUID.randomUUID().toString();
        testPluginId = globalPluginId;
        Instant now = Instant.now();
        jdbcTemplate.update("""
                        INSERT INTO template_plugin_manifest (
                            plugin_id,
                            name,
                            project_id,
                            owner_id,
                            display_name,
                            entry_uri,
                            asset_base_uri,
                            sdk_version,
                            capabilities_json,
                            prompt_schema_json,
                            data_bindings_json,
                            status,
                            scope,
                            visibility,
                            upload_state,
                            source_manifest_json,
                            created_at,
                            updated_at
                        ) VALUES (
                            cast(? as uuid), ?, NULL, ?, ?, ?, ?, ?,
                            cast(? as jsonb),
                            cast(? as jsonb),
                            cast(? as jsonb),
                            ?, ?, ?, ?, cast(? as jsonb), ?, ?
                        )
                        """,
                globalPluginId,
                "quiz",
                77L,
                "题目",
                "dist/index.html",
                "dist/assets",
                "1.0.0",
                "{\"storage\":true}",
                "{}",
                "{\"defaultKey\":\"quiz-record\"}",
                "active",
                "global",
                "public",
                "validated",
                "{\"entryHtml\":\"dist/index.html\",\"assetBaseDir\":\"dist/assets\"}",
                Timestamp.from(now),
                Timestamp.from(now)
        );

        Optional<TemplatePluginManifest> manifest = manifestRepository.findActiveByProjectIdOrGlobalByPluginId(
                "550e8400-e29b-41d4-a716-446655440000", globalPluginId
        );

        assertTrue(manifest.isPresent());
        assertEquals(globalPluginId, manifest.get().getPluginId());
        assertEquals("quiz", manifest.get().getName());
        assertEquals("1.0.0", manifest.get().getSdkVersion());
        assertEquals("quiz-record", manifest.get().getDataBindings().get("defaultKey"));
    }

    @Test
    @DisplayName("项目级插件应优先于平台级插件返回")
    void findActiveByProjectIdOrGlobal_shouldPreferProjectScopedManifest() {
        String projectId = UUID.randomUUID().toString();
        testPluginId = QUIZ_PLUGIN_ID;
        Instant now = Instant.now();
        jdbcTemplate.update("""
                        INSERT INTO template_plugin_manifest (
                            plugin_id,
                            name,
                            project_id,
                            owner_id,
                            display_name,
                            entry_uri,
                            asset_base_uri,
                            sdk_version,
                            capabilities_json,
                            prompt_schema_json,
                            data_bindings_json,
                            status,
                            scope,
                            visibility,
                            upload_state,
                            created_at,
                            updated_at
                        ) VALUES (
                            cast(? as uuid), ?, cast(? as uuid), ?, ?, ?, ?, ?,
                            cast(? as jsonb),
                            cast(? as jsonb),
                            cast(? as jsonb),
                            ?, ?, ?, ?, ?, ?
                        )
                        """,
                QUIZ_PLUGIN_ID,
                "quiz",
                projectId,
                77L,
                "项目题目",
                "/templates/quiz/project.html",
                "/templates/quiz",
                "1.0.0",
                "{\"save\":true}",
                "{}",
                "{\"defaultKey\":\"project-quiz-record\"}",
                "active",
                "project",
                "project",
                "validated",
                Timestamp.from(now),
                Timestamp.from(now)
        );
        TemplatePluginManifest manifest = manifestRepository.findActiveByProjectIdOrGlobalByName(projectId, "quiz")
                .orElseThrow();

        assertEquals(projectId, manifest.getProjectId());
        assertEquals("quiz", manifest.getName());
        assertEquals("1.0.0", manifest.getSdkVersion());
        assertEquals(Map.of("defaultKey", "project-quiz-record"), manifest.getDataBindings());
    }
}
