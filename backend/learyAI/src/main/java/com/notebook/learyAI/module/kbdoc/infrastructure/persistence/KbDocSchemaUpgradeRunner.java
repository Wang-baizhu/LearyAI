// Responsibility: Apply idempotent kb_doc schema upgrades for metadata storage.
package com.notebook.learyAI.module.kbdoc.infrastructure.persistence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class KbDocSchemaUpgradeRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(KbDocSchemaUpgradeRunner.class);
    private final JdbcTemplate jdbcTemplate;

    public KbDocSchemaUpgradeRunner(JdbcTemplate jdbcTemplate) {
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
                        WHERE table_schema = 'public'
                          AND table_name = 'kb_doc'
                          AND column_name = 'instructions'
                    ) AND NOT EXISTS (
                        SELECT 1
                        FROM information_schema.columns
                        WHERE table_schema = 'public'
                          AND table_name = 'kb_doc'
                          AND column_name = 'metadata'
                    ) THEN
                        ALTER TABLE public.kb_doc RENAME COLUMN instructions TO metadata;
                    END IF;
                END $$;
                """);
        log.info("kb_doc schema upgrade ensured: metadata column");
    }
}
