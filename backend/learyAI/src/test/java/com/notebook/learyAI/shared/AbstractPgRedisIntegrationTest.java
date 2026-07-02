// Responsibility: Provide a shared Spring Boot base for tests that need real PostgreSQL and Redis.
package com.notebook.learyAI.shared;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.junit.jupiter.api.Tag;

import java.util.Set;

@SpringBootTest(properties = {
        "usage.service.grpc.port=0",
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.amqp.RabbitAutoConfiguration"
})
@Tag("integration")
public abstract class AbstractPgRedisIntegrationTest {
    @Autowired
    protected StringRedisTemplate stringRedisTemplate;

    protected void deleteRedisByPattern(String pattern) {
        Set<String> keys = stringRedisTemplate.keys(pattern);
        if (keys != null && !keys.isEmpty()) {
            stringRedisTemplate.delete(keys);
        }
    }

    protected boolean tableExists(JdbcTemplate jdbcTemplate, String tableName) {
        Integer count = jdbcTemplate.queryForObject("""
                select count(1)
                from information_schema.tables
                where table_schema = 'public'
                  and table_name = ?
                """, Integer.class, tableName);
        return count != null && count > 0;
    }
}
