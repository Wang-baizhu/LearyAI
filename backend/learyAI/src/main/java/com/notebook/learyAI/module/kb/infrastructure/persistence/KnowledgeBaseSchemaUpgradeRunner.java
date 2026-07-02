// Responsibility: Ensure knowledge_base plugin config columns exist.
package com.notebook.learyAI.module.kb.infrastructure.persistence;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
public class KnowledgeBaseSchemaUpgradeRunner implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(KnowledgeBaseSchemaUpgradeRunner.class);

    private final JdbcTemplate jdbcTemplate;

    public KnowledgeBaseSchemaUpgradeRunner(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(ApplicationArguments args) {
        jdbcTemplate.execute("""
                ALTER TABLE knowledge_base
                ADD COLUMN IF NOT EXISTS enabled_template_plugin_ids_json jsonb
                """);
        log.info("knowledge base schema ensured");
    }
}
