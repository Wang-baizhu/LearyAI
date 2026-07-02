// Responsibility: Configure Redis templates for auth session storage.
package com.notebook.learyAI.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.auth.infrastructure.session.SessionRecord;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.serializer.RedisSerializer;
import org.springframework.data.redis.serializer.StringRedisSerializer;

@Configuration
public class RedisConfig {

    @Bean
    public RedisTemplate<String, SessionRecord> sessionRedisTemplate(
            RedisConnectionFactory connectionFactory,
            ObjectMapper objectMapper
    ) {
        RedisTemplate<String, SessionRecord> template = new RedisTemplate<>();
        template.setConnectionFactory(connectionFactory);
        RedisSerializer<Object> serializer = RedisSerializer.json();
        template.setKeySerializer(new StringRedisSerializer());
        template.setValueSerializer(serializer);
        template.setHashKeySerializer(new StringRedisSerializer());
        template.setHashValueSerializer(serializer);
        return template;
    }
}
