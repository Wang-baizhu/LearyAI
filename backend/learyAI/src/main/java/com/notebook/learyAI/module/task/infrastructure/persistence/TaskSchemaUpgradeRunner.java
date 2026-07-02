// Responsibility: Apply idempotent task table schema upgrades for task orchestration fields.
package com.notebook.learyAI.module.task.infrastructure.persistence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class TaskSchemaUpgradeRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(TaskSchemaUpgradeRunner.class);
    private final JdbcTemplate jdbcTemplate;

    public TaskSchemaUpgradeRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'task'
                          AND column_name = 'task_id'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'task'
                          AND column_name = 'public_task_id'
                    ) THEN
                        ALTER TABLE task RENAME COLUMN task_id TO public_task_id;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS task_dlq_incident (
                    id BIGSERIAL PRIMARY KEY,
                    message_id VARCHAR(128) NOT NULL,
                    source_queue VARCHAR(128) NOT NULL,
                    source_routing_key VARCHAR(128),
                    dlq_type VARCHAR(32) NOT NULL,
                    task_record_id BIGINT NULL,
                    parent_task_record_id BIGINT NULL,
                    project_id VARCHAR(64) NULL,
                    kb_id VARCHAR(64) NULL,
                    stage_run_key VARCHAR(128) NULL,
                    task_type VARCHAR(64) NULL,
                    payload_json TEXT NULL,
                    error_message TEXT NULL,
                    retry_count INTEGER NOT NULL DEFAULT 0,
                    incident_status VARCHAR(32) NOT NULL,
                    compensation_action VARCHAR(128) NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uk_task_dlq_incident_message_queue'
                    ) THEN
                        ALTER TABLE task_dlq_incident
                            ADD CONSTRAINT uk_task_dlq_incident_message_queue
                            UNIQUE (message_id, source_queue);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_dlq_incident_status_created'
                    ) THEN
                        CREATE INDEX idx_task_dlq_incident_status_created
                            ON task_dlq_incident(incident_status, created_at DESC);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_dlq_incident_task'
                    ) THEN
                        CREATE INDEX idx_task_dlq_incident_task
                            ON task_dlq_incident(project_id, task_record_id);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("ALTER TABLE task ADD COLUMN IF NOT EXISTS public_task_id VARCHAR(36)");
        jdbcTemplate.execute("ALTER TABLE task ADD COLUMN IF NOT EXISTS pipeline_type VARCHAR(64)");
        jdbcTemplate.execute("ALTER TABLE task ADD COLUMN IF NOT EXISTS current_stage_key VARCHAR(64)");
        jdbcTemplate.execute("ALTER TABLE task ADD COLUMN IF NOT EXISTS context_json TEXT");
        jdbcTemplate.execute("ALTER TABLE task ADD COLUMN IF NOT EXISTS view_json TEXT");
        jdbcTemplate.execute("""
                UPDATE task
                SET public_task_id = lower(
                    substr(md5(random()::text || clock_timestamp()::text || id::text), 1, 8) || '-' ||
                    substr(md5(random()::text || clock_timestamp()::text || id::text), 9, 4) || '-' ||
                    substr(md5(random()::text || clock_timestamp()::text || id::text), 13, 4) || '-' ||
                    substr(md5(random()::text || clock_timestamp()::text || id::text), 17, 4) || '-' ||
                    substr(md5(random()::text || clock_timestamp()::text || id::text), 21, 12)
                )
                WHERE public_task_id IS NULL OR btrim(public_task_id) = ''
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'task' AND column_name = 'type'
                    ) THEN
                        UPDATE task
                        SET pipeline_type = type
                        WHERE pipeline_type IS NULL
                          AND type IS NOT NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'task' AND column_name = 'current_stage'
                    ) THEN
                        UPDATE task
                        SET current_stage_key = current_stage
                        WHERE current_stage_key IS NULL
                          AND current_stage IS NOT NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'task' AND column_name = 'pipeline_context'
                    ) THEN
                        UPDATE task
                        SET context_json = pipeline_context
                        WHERE context_json IS NULL
                          AND pipeline_context IS NOT NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'task' AND column_name = 'view_data'
                    ) THEN
                        UPDATE task
                        SET view_json = view_data
                        WHERE view_json IS NULL
                          AND view_data IS NOT NULL;
                    END IF;
                END $$;
                """);
        // Ensure kb_id exists for kb-scoped task queries and SSE fanout.
        jdbcTemplate.execute("ALTER TABLE task ADD COLUMN IF NOT EXISTS kb_id VARCHAR(64)");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS metadata");
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS task_stage_execution (
                    id BIGSERIAL PRIMARY KEY,
                    task_id BIGINT NOT NULL,
                    stage_key VARCHAR(64) NOT NULL,
                    executor_type VARCHAR(32) NOT NULL,
                    execution_type VARCHAR(64) NOT NULL,
                    status VARCHAR(32) NOT NULL,
                    input_json TEXT,
                    output_json TEXT,
                    error_json TEXT,
                    attempt_no INTEGER NOT NULL DEFAULT 1,
                    started_at TIMESTAMPTZ NULL,
                    finished_at TIMESTAMPTZ NULL,
                    created_at TIMESTAMPTZ NOT NULL,
                    updated_at TIMESTAMPTZ NOT NULL
                )
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uk_task_stage_execution_task_stage'
                    ) THEN
                        ALTER TABLE task_stage_execution
                            ADD CONSTRAINT uk_task_stage_execution_task_stage
                            UNIQUE (task_id, stage_key);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_stage_execution_task_stage'
                    ) THEN
                        CREATE INDEX idx_task_stage_execution_task_stage
                            ON task_stage_execution(task_id, stage_key);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_stage_execution_task_status'
                    ) THEN
                        CREATE INDEX idx_task_stage_execution_task_status
                            ON task_stage_execution(task_id, status);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'task'
                          AND column_name = 'project_id'
                    ) THEN
                        ALTER TABLE task
                            ALTER COLUMN project_id DROP NOT NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_name = 'task' AND column_name = 'parent_task_id'
                    ) THEN
                        INSERT INTO task_stage_execution (
                            id,
                            task_id,
                            stage_key,
                            executor_type,
                            execution_type,
                            status,
                            input_json,
                            output_json,
                            error_json,
                            attempt_no,
                            started_at,
                            finished_at,
                            created_at,
                            updated_at
                        )
                        SELECT
                            t.id,
                            t.parent_task_id,
                            COALESCE(t.stage_run_key, t.type),
                            COALESCE(t.type, 'stage'),
                            CASE
                                WHEN t.type = 'agent'
                                    THEN COALESCE(NULLIF((CAST(t.stage_payload AS jsonb) ->> 'agentTaskType'), ''), NULLIF(t.type_id, ''), 'agent')
                                WHEN t.type = 'doc'
                                    THEN 'doc'
                                ELSE COALESCE(NULLIF(t.type_id, ''), COALESCE(t.type, 'stage'))
                            END,
                            t.status,
                            t.stage_payload,
                            t.stage_result,
                            CASE
                                WHEN (t.error_code IS NOT NULL AND btrim(t.error_code) <> '')
                                  OR (t.error_message IS NOT NULL AND btrim(t.error_message) <> '')
                                    THEN jsonb_build_object(
                                        'code', NULLIF(t.error_code, ''),
                                        'message', NULLIF(t.error_message, ''),
                                        'retryable', false
                                    )::text
                                ELSE NULL
                            END,
                            1,
                            CASE
                                WHEN t.status = 'PROCESSING' THEN COALESCE(t.updated_at, t.created_at)
                                ELSE t.created_at
                            END,
                            CASE
                                WHEN t.status IN ('DONE', 'FAILED') THEN COALESCE(t.updated_at, t.created_at)
                                ELSE NULL
                            END,
                            t.created_at,
                            t.updated_at
                        FROM task t
                        WHERE t.parent_task_id IS NOT NULL
                          AND COALESCE(t.stage_run_key, t.type) IS NOT NULL
                          AND NOT EXISTS (
                              SELECT 1
                              FROM task_stage_execution se
                              WHERE se.id = t.id
                          );
                        DELETE FROM task WHERE parent_task_id IS NOT NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                SELECT setval(
                    pg_get_serial_sequence('task_stage_execution', 'id'),
                    COALESCE((SELECT MAX(id) FROM task_stage_execution), 1),
                    true
                )
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'task_status_event'
                          AND column_name = 'task_id'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'task_status_event'
                          AND column_name = 'task_record_id'
                    ) THEN
                        ALTER TABLE task_status_event RENAME COLUMN task_id TO task_record_id;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("ALTER TABLE task_status_event ADD COLUMN IF NOT EXISTS task_record_id BIGINT");
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uk_task_parent_type'
                    ) THEN
                        ALTER TABLE task DROP CONSTRAINT uk_task_parent_type;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_constraint
                        WHERE conname = 'uk_task_parent_type_stage'
                    ) THEN
                        ALTER TABLE task DROP CONSTRAINT uk_task_parent_type_stage;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'uk_task_public_task_id'
                    ) THEN
                        CREATE UNIQUE INDEX uk_task_public_task_id
                            ON task(public_task_id)
                            WHERE public_task_id IS NOT NULL;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_type_id'
                    ) THEN
                        DROP INDEX idx_task_type_id;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_type_status'
                    ) THEN
                        DROP INDEX idx_task_type_status;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_pipeline_type_status'
                    ) THEN
                        CREATE INDEX idx_task_pipeline_type_status
                            ON task(pipeline_type, status);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'uk_task_task_id'
                    ) THEN
                        DROP INDEX uk_task_task_id;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_parent_stage'
                    ) THEN
                        DROP INDEX idx_task_parent_stage;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_visible'
                    ) THEN
                        DROP INDEX idx_task_visible;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_task_id'
                    ) THEN
                        DROP INDEX idx_task_task_id;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS parent_task_id");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS stage_run_key");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS type");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS type_id");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS pipeline_context");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS current_stage");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS stage_payload");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS stage_result");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS view_data");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS error_code");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS error_message");
        jdbcTemplate.execute("ALTER TABLE task DROP COLUMN IF EXISTS visible");
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_public_task_id'
                    ) THEN
                        CREATE INDEX idx_task_public_task_id
                            ON task(public_task_id);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_project_kb_created'
                    ) THEN
                        CREATE INDEX idx_task_project_kb_created
                            ON task(project_id, kb_id, created_at DESC);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_status_event_task'
                    ) THEN
                        DROP INDEX idx_task_status_event_task;
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_indexes
                        WHERE schemaname = current_schema()
                          AND indexname = 'idx_task_status_event_task'
                    ) THEN
                        CREATE INDEX idx_task_status_event_task
                            ON task_status_event(project_id, task_record_id);
                    END IF;
                END $$;
                """);
        jdbcTemplate.execute("""
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_name = 'task_status_event'
                          AND column_name = 'project_id'
                    ) THEN
                        ALTER TABLE task_status_event
                            ALTER COLUMN project_id DROP NOT NULL;
                    END IF;
                END $$;
                """);
        log.info("task schema upgrade ensured: task aggregate columns only + task_stage_execution + task_record_id + task_dlq_incident");
    }
}
