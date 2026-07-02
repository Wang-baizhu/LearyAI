// Responsibility: Verify template schema upgrade runner applies final template_data schema migrations.
package com.notebook.learyAI.module.template.infrastructure.persistence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class TemplateSchemaUpgradeRunnerTest {
    @Mock
    private JdbcTemplate jdbcTemplate;

    @Test
    @DisplayName("run 应清理旧约束并建立 template_data 唯一键")
    void run_shouldDropLegacyTemplateDataUniqueConstraint() {
        TemplateSchemaUpgradeRunner runner = new TemplateSchemaUpgradeRunner(jdbcTemplate);

        runner.run(new DefaultApplicationArguments(new String[0]));

        verify(jdbcTemplate).execute("ALTER TABLE template_data DROP CONSTRAINT IF EXISTS uk_template_data_template_user");
        verify(jdbcTemplate).execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_template_data_template_user_key
                ON template_data(template_id, user_id, "key")
                """);
    }

    @Test
    @DisplayName("run 应把历史模板插件 capabilities 迁移为新对象格式")
    void run_shouldNormalizeLegacyTemplatePluginCapabilities() {
        TemplateSchemaUpgradeRunner runner = new TemplateSchemaUpgradeRunner(jdbcTemplate);

        runner.run(new DefaultApplicationArguments(new String[0]));

        ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
        verify(jdbcTemplate, atLeastOnce()).execute(sqlCaptor.capture());
        List<String> executedSql = sqlCaptor.getAllValues();

        assertTrue(
                executedSql.stream().anyMatch((sql) -> sql.contains("SET capabilities_json = jsonb_build_object")),
                "expected capabilities_json normalization SQL to run"
        );
        assertTrue(
                executedSql.stream().anyMatch((sql) -> sql.contains("SET source_manifest_json = jsonb_set")),
                "expected source_manifest_json normalization SQL to run"
        );
        assertFalse(
                executedSql.stream().anyMatch((sql) -> sql.contains("themeSync")),
                "expected final normalization SQL to stop referencing themeSync"
        );
    }
}
