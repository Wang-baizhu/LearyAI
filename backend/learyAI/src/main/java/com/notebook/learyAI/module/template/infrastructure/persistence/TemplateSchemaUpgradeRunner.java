// Responsibility: Ensure template plugin registry and final template schema columns exist.
package com.notebook.learyAI.module.template.infrastructure.persistence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@Order(0)
public class TemplateSchemaUpgradeRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(TemplateSchemaUpgradeRunner.class);
    private final JdbcTemplate jdbcTemplate;

    public TemplateSchemaUpgradeRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            ensureTemplatePluginManifestTable();
            ensureTemplatePluginInstallationTable();
            ensureTemplateDevPackageVersionTable();
            ensureTemplateColumns();
            ensureTemplateDataColumns();
        } catch (Exception ex) {
            log.error("template schema upgrade failed", ex);
            throw ex;
        }
    }

    private void ensureTemplatePluginManifestTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS template_plugin_manifest (
                    id BIGSERIAL PRIMARY KEY,
                    plugin_id UUID NOT NULL,
                    name VARCHAR(64) NOT NULL,
                    project_id UUID NULL,
                    owner_id BIGINT NOT NULL,
                    display_name VARCHAR(128) NOT NULL,
                    entry_uri VARCHAR(1024) NULL,
                    asset_base_uri VARCHAR(1024) NULL,
                    sdk_version VARCHAR(32) NOT NULL,
                    capabilities_json JSONB NOT NULL,
                    prompt_schema_json JSONB NOT NULL,
                    data_bindings_json JSONB NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    scope VARCHAR(32) NOT NULL DEFAULT 'project',
                    visibility VARCHAR(32) NOT NULL DEFAULT 'project',
                    upload_state VARCHAR(32) NOT NULL DEFAULT 'empty',
                    source_manifest_json JSONB NULL,
                    validation_result_json JSONB NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS name VARCHAR(64)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS asset_base_uri VARCHAR(1024)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS scope VARCHAR(32)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS visibility VARCHAR(32)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS upload_state VARCHAR(32)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS source_manifest_json JSONB
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS validation_result_json JSONB
                """);
        jdbcTemplate.execute("""
                DROP INDEX IF EXISTS idx_template_plugin_manifest_publish_session
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                DROP COLUMN IF EXISTS publish_session_id
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET name = plugin_id
                WHERE name IS NULL OR btrim(name) = ''
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET scope = 'project'
                WHERE scope IS NULL OR btrim(scope) = ''
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET visibility = 'project'
                WHERE visibility IS NULL OR btrim(visibility) = ''
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET upload_state = case
                    when entry_uri is null or btrim(entry_uri) = '' then 'empty'
                    else 'validated'
                end
                WHERE upload_state IS NULL OR btrim(upload_state) = ''
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET validation_result_json = jsonb_build_object(
                    'passed', CASE
                        WHEN lower(upload_state) = 'validated' THEN true
                        WHEN lower(upload_state) = 'validation_failed' THEN false
                        ELSE null
                    END,
                    'warnings', '[]'::jsonb,
                    'checks', '[]'::jsonb
                )
                WHERE validation_result_json IS NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ADD COLUMN IF NOT EXISTS plugin_id_uuid UUID
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET plugin_id_uuid = CASE
                    WHEN plugin_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                        THEN plugin_id::uuid
                    WHEN plugin_id::text = 'mindmap' THEN '11111111-1111-1111-1111-111111111111'::uuid
                    WHEN plugin_id::text = 'quiz' THEN '22222222-2222-2222-2222-222222222222'::uuid
                    WHEN plugin_id::text = 'card' THEN '33333333-3333-3333-3333-333333333333'::uuid
                    ELSE (
                        substr(md5(coalesce(plugin_id::text, '') || ':' || coalesce(project_id::text, '')), 1, 8)
                        || '-' || substr(md5(coalesce(plugin_id::text, '') || ':' || coalesce(project_id::text, '')), 9, 4)
                        || '-' || substr(md5(coalesce(plugin_id::text, '') || ':' || coalesce(project_id::text, '')), 13, 4)
                        || '-' || substr(md5(coalesce(plugin_id::text, '') || ':' || coalesce(project_id::text, '')), 17, 4)
                        || '-' || substr(md5(coalesce(plugin_id::text, '') || ':' || coalesce(project_id::text, '')), 21, 12)
                    )::uuid
                END
                WHERE plugin_id_uuid IS NULL
                """);
        jdbcTemplate.execute("DROP INDEX IF EXISTS uk_template_plugin_manifest_scope_id_version");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_template_plugin_manifest_project_plugin_status");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_template_plugin_manifest_plugin_id");
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ALTER COLUMN plugin_id TYPE UUID USING plugin_id_uuid
                """);
        jdbcTemplate.execute("ALTER TABLE template_plugin_manifest DROP COLUMN IF EXISTS plugin_id_uuid");
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_plugin_manifest_plugin_id
                ON template_plugin_manifest(plugin_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_plugin_manifest_name
                ON template_plugin_manifest(name)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_plugin_manifest_project_plugin_status
                ON template_plugin_manifest(project_id, plugin_id, status)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_plugin_manifest_project_name_version
                ON template_plugin_manifest(project_id, name)
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_template_plugin_manifest_scope_id
                ON template_plugin_manifest(
                    coalesce(project_id, '00000000-0000-0000-0000-000000000000'::uuid),
                    plugin_id
                )
                """);
        jdbcTemplate.execute("DROP INDEX IF EXISTS uk_template_plugin_manifest_scope_id_version");
        jdbcTemplate.execute("ALTER TABLE template_plugin_manifest DROP COLUMN IF EXISTS plugin_version");
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ALTER COLUMN entry_uri DROP NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ALTER COLUMN scope SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ALTER COLUMN visibility SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_manifest
                ALTER COLUMN upload_state SET NOT NULL
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET capabilities_json = jsonb_build_object(
                    'render', CASE
                        WHEN jsonb_typeof(capabilities_json) = 'array' THEN capabilities_json @> '["render"]'::jsonb
                        ELSE coalesce((capabilities_json->>'render')::boolean, false)
                    END,
                    'theme', CASE
                        WHEN jsonb_typeof(capabilities_json) = 'array' THEN capabilities_json @> '["theme"]'::jsonb
                        ELSE coalesce((capabilities_json->>'theme')::boolean, false)
                    END,
                    'storage', CASE
                        WHEN jsonb_typeof(capabilities_json) = 'array' THEN capabilities_json @> '["storage"]'::jsonb
                        ELSE coalesce((capabilities_json->>'storage')::boolean, false)
                    END,
                    'textEdit', CASE
                        WHEN jsonb_typeof(capabilities_json) = 'array' THEN capabilities_json @> '["textEdit"]'::jsonb OR capabilities_json @> '["requestTextEdit"]'::jsonb
                        ELSE coalesce((capabilities_json->>'textEdit')::boolean, false) OR coalesce((capabilities_json->>'requestTextEdit')::boolean, false)
                    END,
                    'aiAction', CASE
                        WHEN jsonb_typeof(capabilities_json) = 'array' THEN capabilities_json @> '["aiAction"]'::jsonb OR capabilities_json @> '["requestAiAction"]'::jsonb
                        ELSE coalesce((capabilities_json->>'aiAction')::boolean, false) OR coalesce((capabilities_json->>'requestAiAction')::boolean, false)
                    END,
                    'citationJump', CASE
                        WHEN jsonb_typeof(capabilities_json) = 'array' THEN capabilities_json @> '["citationJump"]'::jsonb OR capabilities_json @> '["requestCitationJump"]'::jsonb
                        ELSE coalesce((capabilities_json->>'citationJump')::boolean, false) OR coalesce((capabilities_json->>'requestCitationJump')::boolean, false)
                    END
                )
                WHERE capabilities_json IS NOT NULL
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_manifest
                SET source_manifest_json = jsonb_set(
                    source_manifest_json,
                    '{capabilities}',
                    jsonb_build_object(
                        'render', CASE
                            WHEN jsonb_typeof(source_manifest_json->'capabilities') = 'array' THEN source_manifest_json->'capabilities' @> '["render"]'::jsonb
                            ELSE coalesce((source_manifest_json->'capabilities'->>'render')::boolean, false)
                        END,
                        'theme', CASE
                            WHEN jsonb_typeof(source_manifest_json->'capabilities') = 'array' THEN source_manifest_json->'capabilities' @> '["theme"]'::jsonb
                            ELSE coalesce((source_manifest_json->'capabilities'->>'theme')::boolean, false)
                        END,
                        'storage', CASE
                            WHEN jsonb_typeof(source_manifest_json->'capabilities') = 'array' THEN source_manifest_json->'capabilities' @> '["storage"]'::jsonb
                            ELSE coalesce((source_manifest_json->'capabilities'->>'storage')::boolean, false)
                        END,
                        'textEdit', CASE
                            WHEN jsonb_typeof(source_manifest_json->'capabilities') = 'array' THEN source_manifest_json->'capabilities' @> '["textEdit"]'::jsonb OR source_manifest_json->'capabilities' @> '["requestTextEdit"]'::jsonb
                            ELSE coalesce((source_manifest_json->'capabilities'->>'textEdit')::boolean, false) OR coalesce((source_manifest_json->'capabilities'->>'requestTextEdit')::boolean, false)
                        END,
                        'aiAction', CASE
                            WHEN jsonb_typeof(source_manifest_json->'capabilities') = 'array' THEN source_manifest_json->'capabilities' @> '["aiAction"]'::jsonb OR source_manifest_json->'capabilities' @> '["requestAiAction"]'::jsonb
                            ELSE coalesce((source_manifest_json->'capabilities'->>'aiAction')::boolean, false) OR coalesce((source_manifest_json->'capabilities'->>'requestAiAction')::boolean, false)
                        END,
                        'citationJump', CASE
                            WHEN jsonb_typeof(source_manifest_json->'capabilities') = 'array' THEN source_manifest_json->'capabilities' @> '["citationJump"]'::jsonb OR source_manifest_json->'capabilities' @> '["requestCitationJump"]'::jsonb
                            ELSE coalesce((source_manifest_json->'capabilities'->>'citationJump')::boolean, false) OR coalesce((source_manifest_json->'capabilities'->>'requestCitationJump')::boolean, false)
                        END
                    ),
                    true
                )
                WHERE source_manifest_json IS NOT NULL
                  AND source_manifest_json ? 'capabilities'
                """);
        jdbcTemplate.execute("ALTER TABLE template_plugin_manifest DROP COLUMN IF EXISTS category");
        jdbcTemplate.execute("ALTER TABLE template_plugin_manifest DROP COLUMN IF EXISTS generator_key");
        jdbcTemplate.execute("ALTER TABLE template_plugin_manifest DROP COLUMN IF EXISTS field_schema_json");
    }

    private void ensureTemplateDevPackageVersionTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS template_dev_package_version (
                    id BIGSERIAL PRIMARY KEY,
                    platform VARCHAR(32) NOT NULL,
                    version VARCHAR(64) NOT NULL,
                    file_name VARCHAR(255) NOT NULL,
                    object_key VARCHAR(1024) NOT NULL,
                    content_type VARCHAR(128) NOT NULL,
                    size_bytes BIGINT NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    created_by BIGINT NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_dev_package_version
                ADD COLUMN IF NOT EXISTS platform VARCHAR(32)
                """);
        jdbcTemplate.execute("""
                UPDATE template_dev_package_version
                SET platform = 'windows'
                WHERE platform IS NULL OR btrim(platform) = ''
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_dev_package_version
                ALTER COLUMN platform SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_dev_package_version
                DROP CONSTRAINT IF EXISTS template_dev_package_version_version_key
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_dev_package_version_status
                ON template_dev_package_version(status)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_dev_package_version_platform_status
                ON template_dev_package_version(platform, status)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_dev_package_version_created_at
                ON template_dev_package_version(created_at)
                """);
        jdbcTemplate.execute("DROP INDEX IF EXISTS uk_template_dev_package_version_active");
        jdbcTemplate.execute("DROP INDEX IF EXISTS uk_template_dev_package_version_platform_version");
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_template_dev_package_version_platform_version
                ON template_dev_package_version(platform, version)
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_template_dev_package_version_active
                ON template_dev_package_version(platform, status)
                WHERE status = 'ACTIVE'
                """);
    }

    private void ensureTemplatePluginInstallationTable() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS template_plugin_installation (
                    id BIGSERIAL PRIMARY KEY,
                    installation_id UUID NOT NULL,
                    user_id BIGINT NOT NULL,
                    plugin_id UUID NOT NULL,
                    install_source VARCHAR(32) NOT NULL,
                    installed_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ADD COLUMN IF NOT EXISTS installation_id UUID
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ADD COLUMN IF NOT EXISTS user_id BIGINT
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ADD COLUMN IF NOT EXISTS plugin_id UUID
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ADD COLUMN IF NOT EXISTS install_source VARCHAR(32)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ADD COLUMN IF NOT EXISTS installed_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_installation
                SET installation_id = gen_random_uuid()
                WHERE installation_id IS NULL
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_installation
                SET install_source = 'market'
                WHERE install_source IS NULL OR btrim(install_source) = ''
                """);
        jdbcTemplate.execute("""
                UPDATE template_plugin_installation
                SET installed_at = coalesce(installed_at, created_at, updated_at, now()),
                    created_at = coalesce(created_at, installed_at, updated_at, now()),
                    updated_at = coalesce(updated_at, installed_at, created_at, now())
                WHERE installed_at IS NULL OR created_at IS NULL OR updated_at IS NULL
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_template_plugin_installation_installation_id
                ON template_plugin_installation(installation_id)
                """);
        jdbcTemplate.execute("""
                DELETE FROM template_plugin_installation t
                USING template_plugin_installation newer
                WHERE t.user_id = newer.user_id
                  AND t.plugin_id = newer.plugin_id
                  AND (
                    t.installed_at < newer.installed_at
                    OR (t.installed_at = newer.installed_at AND t.id < newer.id)
                  )
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                DROP CONSTRAINT IF EXISTS uk_template_plugin_installation_user_plugin_version
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                DROP CONSTRAINT IF EXISTS uk_template_plugin_installation_user_plugin
                """);
        jdbcTemplate.execute("""
                DROP INDEX IF EXISTS uk_template_plugin_installation_user_plugin_version
                """);
        jdbcTemplate.execute("""
                DROP INDEX IF EXISTS uk_template_plugin_installation_user_plugin
                """);
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_template_plugin_installation_user_plugin
                ON template_plugin_installation(user_id, plugin_id)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_plugin_installation_user_installed_at
                ON template_plugin_installation(user_id, installed_at desc)
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_plugin_installation_plugin
                ON template_plugin_installation(plugin_id)
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ALTER COLUMN installation_id SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ALTER COLUMN user_id SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ALTER COLUMN plugin_id SET NOT NULL
                """);
        jdbcTemplate.execute("ALTER TABLE template_plugin_installation DROP COLUMN IF EXISTS plugin_version");
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ALTER COLUMN install_source SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ALTER COLUMN installed_at SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ALTER COLUMN created_at SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_plugin_installation
                ALTER COLUMN updated_at SET NOT NULL
                """);
    }

    private void ensureTemplateColumns() {
        jdbcTemplate.execute("ALTER TABLE templates ADD COLUMN IF NOT EXISTS plugin_id UUID");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_templates_project_plugin_id");
        jdbcTemplate.execute("ALTER TABLE templates DROP COLUMN IF EXISTS plugin_version");
        jdbcTemplate.execute("ALTER TABLE templates DROP COLUMN IF EXISTS plugin_id_uuid");
        jdbcTemplate.execute("ALTER TABLE templates DROP COLUMN IF EXISTS type");
        jdbcTemplate.execute("ALTER TABLE templates DROP COLUMN IF EXISTS generator_key");
        jdbcTemplate.execute("ALTER TABLE templates DROP COLUMN IF EXISTS category");
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_templates_project_plugin_id
                ON templates(project_id, plugin_id)
                """);
    }

    private void ensureTemplateDataColumns() {
        jdbcTemplate.execute("ALTER TABLE template_data ADD COLUMN IF NOT EXISTS \"key\" VARCHAR(64)");
        jdbcTemplate.execute("ALTER TABLE template_data ADD COLUMN IF NOT EXISTS value TEXT");
        jdbcTemplate.execute("""
                delete from template_data td
                using (
                    select id from (
                        select id,
                               row_number() over (
                                   partition by template_id, user_id, "key"
                                   order by updated_at desc, created_at desc, id desc
                               ) as row_num
                        from template_data
                    ) duplicated
                    where duplicated.row_num > 1
                ) stale
                where td.id = stale.id
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_data
                ALTER COLUMN "key" SET NOT NULL
                """);
        jdbcTemplate.execute("""
                ALTER TABLE template_data
                ALTER COLUMN value SET NOT NULL
                """);
        jdbcTemplate.execute("ALTER TABLE template_data DROP COLUMN IF EXISTS data_type");
        jdbcTemplate.execute("ALTER TABLE template_data DROP CONSTRAINT IF EXISTS uk_template_data_template_user");
        jdbcTemplate.execute("ALTER TABLE template_data DROP CONSTRAINT IF EXISTS uk_template_data_template_user_key");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_template_data_template_user_slot_created_at");
        jdbcTemplate.execute("DROP INDEX IF EXISTS idx_template_data_template_user_created_at");
        jdbcTemplate.execute("DROP INDEX IF EXISTS uk_template_data_template_user_key");
        jdbcTemplate.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS uk_template_data_template_user_key
                ON template_data(template_id, user_id, "key")
                """);
        jdbcTemplate.execute("""
                CREATE INDEX IF NOT EXISTS idx_template_data_template_user_created_at
                ON template_data(template_id, user_id, created_at)
                """);
        jdbcTemplate.execute("ALTER TABLE template_data DROP COLUMN IF EXISTS slot_key");
        jdbcTemplate.execute("ALTER TABLE template_data DROP COLUMN IF EXISTS content");
    }
}
