// Responsibility: Provide reusable Redis connection utilities for integration tests.
package com.notebook.learyAI.shared;

import org.springframework.core.io.support.PropertiesLoaderUtils;
import org.springframework.data.redis.connection.RedisPassword;
import org.springframework.data.redis.connection.RedisStandaloneConfiguration;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;

import java.util.Properties;

public final class RedisIntegrationSupport {
    private RedisIntegrationSupport() {
    }

    public static RedisClient createClientFromMainProperties() {
        Properties properties = loadMainApplicationProperties();
        RedisStandaloneConfiguration standalone = new RedisStandaloneConfiguration(
                requireText(properties, "spring.data.redis.host"),
                Integer.parseInt(requireText(properties, "spring.data.redis.port"))
        );
        String redisPassword = trimToNull(properties.getProperty("spring.data.redis.password"));
        if (redisPassword != null) {
            standalone.setPassword(RedisPassword.of(redisPassword));
        }
        LettuceConnectionFactory connectionFactory = new LettuceConnectionFactory(standalone);
        connectionFactory.afterPropertiesSet();

        StringRedisTemplate redisTemplate = new StringRedisTemplate();
        redisTemplate.setConnectionFactory(connectionFactory);
        redisTemplate.afterPropertiesSet();
        return new RedisClient(connectionFactory, redisTemplate);
    }

    private static Properties loadMainApplicationProperties() {
        try {
            return PropertiesLoaderUtils.loadAllProperties("application.properties");
        } catch (Exception ex) {
            throw new IllegalStateException("load application.properties failed", ex);
        }
    }

    private static String requireText(Properties properties, String key) {
        String value = trimToNull(properties.getProperty(key));
        if (value == null) {
            throw new IllegalStateException("missing required property: " + key);
        }
        return value;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    public static final class RedisClient implements AutoCloseable {
        private final LettuceConnectionFactory connectionFactory;
        private final StringRedisTemplate redisTemplate;

        private RedisClient(LettuceConnectionFactory connectionFactory, StringRedisTemplate redisTemplate) {
            this.connectionFactory = connectionFactory;
            this.redisTemplate = redisTemplate;
        }

        public StringRedisTemplate redisTemplate() {
            return redisTemplate;
        }

        @Override
        public void close() {
            connectionFactory.destroy();
        }
    }
}
