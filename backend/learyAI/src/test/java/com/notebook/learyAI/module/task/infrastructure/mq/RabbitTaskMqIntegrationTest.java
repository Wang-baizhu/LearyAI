// Responsibility: Verify RabbitMQ topology and task publisher routing with a real broker.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.support.PropertiesLoaderUtils;
import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.CachingConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.time.Instant;
import java.util.Map;
import java.util.Properties;
import java.util.concurrent.ThreadLocalRandom;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

@Tag("integration")
class RabbitTaskMqIntegrationTest {
    private CachingConnectionFactory connectionFactory;
    private RabbitAdmin rabbitAdmin;
    private String exchangeName;
    private String statusQueueName;
    private String retryQueueName;
    private String dlqQueueName;
    private String probeQueueName;
    private String statusRoutingKey;
    private String retryRoutingKey;
    private String dlqRoutingKey;
    private String probeRoutingKey;

    @AfterEach
    void tearDown() {
        if (rabbitAdmin != null) {
            safeDeleteQueue(probeQueueName);
            safeDeleteQueue(statusQueueName);
            safeDeleteQueue(retryQueueName);
            safeDeleteQueue(dlqQueueName);
            safeDeleteExchange(exchangeName);
        }
        if (connectionFactory != null) {
            connectionFactory.destroy();
        }
    }

    @Test
    @DisplayName("外部 RabbitMQ：TaskMqConfig 声明的路由应进入目标队列")
    void topology_shouldRouteMessagesToDeclaredQueues() {
        RabbitTemplate rabbitTemplate = buildTemplateAndDeclareTopology();

        rabbitTemplate.convertAndSend(exchangeName, statusRoutingKey, "status");
        rabbitTemplate.convertAndSend(exchangeName, retryRoutingKey, "retry");
        rabbitTemplate.convertAndSend(exchangeName, dlqRoutingKey, "dlq");

        Message statusMessage = rabbitTemplate.receive(statusQueueName, 5000);
        Message retryMessage = rabbitTemplate.receive(retryQueueName, 5000);
        Message dlqMessage = rabbitTemplate.receive(dlqQueueName, 5000);

        assertNotNull(statusMessage);
        assertNotNull(retryMessage);
        assertNotNull(dlqMessage);
    }

    @Test
    @DisplayName("外部 RabbitMQ：RabbitTaskMqPublisher 应按 command 路由并发送 envelope")
    void publisher_shouldRouteByTaskType() throws Exception {
        RabbitTemplate rabbitTemplate = buildTemplateAndDeclareTopology();
        TopicExchange exchange = new TopicExchange(exchangeName, true, false);
        Queue probeQueue = new Queue(probeQueueName, true);
        Binding probeBinding = BindingBuilder.bind(probeQueue).to(exchange).with(probeRoutingKey);
        rabbitAdmin.declareQueue(probeQueue);
        rabbitAdmin.declareBinding(probeBinding);

        RabbitTaskMqPublisher publisher =
                new RabbitTaskMqPublisher(rabbitTemplate, new ObjectMapper(), exchangeName,
                        "it.task.command.doc.process", "it.task.command.agent.run",
                        "it.task.command.template-plugin.publish");
        Task task = new Task(
                88L,
                null,
                "b25b3db6-3a3a-46ac-8117-06dc938acaed",
                "kb-1",
                1001L,
                "doc",
                TaskStatus.UPLOADING,
                null,
                "{}",
                null,
                "doc-1",
                Instant.now(),
                Instant.now()
        );

        StageExecution stageExecution = new StageExecution(
                188L,
                task.getTaskRecordId(),
                "doc:main",
                TaskTypes.DOC,
                TaskTypes.DOC,
                TaskStatus.PROCESSING,
                "{}",
                null,
                null,
                1,
                Instant.now(),
                null,
                Instant.now(),
                Instant.now()
        );

        publisher.publishStageCommand(task, stageExecution, Map.of("source", "integration", "kbId", "kb-1"));

        Message message = rabbitTemplate.receive(probeQueueName, 5000);
        assertNotNull(message);
        JsonNode payload = new ObjectMapper().readTree(message.getBody());
        assertEquals("doc", payload.get("taskType").asText());
        assertEquals(188L, payload.get("taskRecordId").asLong());
        assertEquals(88L, payload.get("parentTaskRecordId").asLong());
        assertEquals("doc:main", payload.get("stageRunKey").asText());
        assertEquals("doc-1", payload.get("payload").get("typeId").asText());
        assertEquals(1001L, payload.get("userId").asLong());
    }

    @Test
    @DisplayName("外部 RabbitMQ：retry 队列消息应在 TTL 后死信回流到 status 队列，且不应进入 DLQ")
    void retryMessage_shouldDeadLetterBackToStatusAfterTtl() {
        RabbitTemplate rabbitTemplate = buildTemplateAndDeclareTopology();

        rabbitTemplate.convertAndSend(exchangeName, retryRoutingKey, "retry-dead-letter");

        Message statusMessage = waitForMessage(rabbitTemplate, statusQueueName, 10_000L);
        assertNotNull(statusMessage);
        assertEquals("retry-dead-letter", new String(statusMessage.getBody(), StandardCharsets.UTF_8));

        Message dlqMessage = rabbitTemplate.receive(dlqQueueName, 300);
        assertNull(dlqMessage);
    }

    private RabbitTemplate buildTemplateAndDeclareTopology() {
        long caseId = ThreadLocalRandom.current().nextLong(1_000_000_000L, 9_999_999_999L);
        exchangeName = "it.task.exchange." + caseId;
        statusQueueName = "it.task.status.queue." + caseId;
        retryQueueName = "it.task.status.retry.queue." + caseId;
        dlqQueueName = "it.task.status.dlq." + caseId;
        probeQueueName = "it.task.probe.queue." + caseId;
        statusRoutingKey = "it.task.status." + caseId;
        retryRoutingKey = "it.task.status.retry." + caseId;
        dlqRoutingKey = "it.task.status.dlq." + caseId;
        probeRoutingKey = "it.task.command.doc.process";

        Properties properties = loadMainApplicationProperties();
        com.rabbitmq.client.ConnectionFactory rabbitConnectionFactory = new com.rabbitmq.client.ConnectionFactory();
        rabbitConnectionFactory.setHost(requireText(properties, "spring.rabbitmq.host"));
        rabbitConnectionFactory.setPort(Integer.parseInt(requireText(properties, "spring.rabbitmq.port")));
        rabbitConnectionFactory.setUsername(requireText(properties, "spring.rabbitmq.username"));
        rabbitConnectionFactory.setPassword(requireText(properties, "spring.rabbitmq.password"));
        String virtualHost = trimToNull(properties.getProperty("spring.rabbitmq.virtual-host"));
        if (virtualHost != null) {
            rabbitConnectionFactory.setVirtualHost(virtualHost);
        }
        connectionFactory = new CachingConnectionFactory(rabbitConnectionFactory);

        rabbitAdmin = new RabbitAdmin(connectionFactory);
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        TaskMqConfig config = new TaskMqConfig();

        TopicExchange exchange = config.taskExchange(exchangeName);
        Queue taskStatusQueue = config.taskStatusQueue(statusQueueName, exchangeName, dlqRoutingKey);
        Queue taskRetryQueue = config.taskStatusRetryQueue(retryQueueName, exchangeName, statusRoutingKey, 1000L);
        Queue taskDlqQueue = config.taskStatusDlq(dlqQueueName);
        Binding statusBinding = config.taskStatusBinding(taskStatusQueue, exchange, statusRoutingKey);
        Binding retryBinding = config.taskStatusRetryBinding(taskRetryQueue, exchange, retryRoutingKey);
        Binding dlqBinding = config.taskStatusDlqBinding(taskDlqQueue, exchange, dlqRoutingKey);

        rabbitAdmin.declareExchange(exchange);
        rabbitAdmin.declareQueue(taskStatusQueue);
        rabbitAdmin.declareQueue(taskRetryQueue);
        rabbitAdmin.declareQueue(taskDlqQueue);
        rabbitAdmin.declareBinding(statusBinding);
        rabbitAdmin.declareBinding(retryBinding);
        rabbitAdmin.declareBinding(dlqBinding);
        return rabbitTemplate;
    }

    private Properties loadMainApplicationProperties() {
        try {
            return PropertiesLoaderUtils.loadAllProperties("application.properties");
        } catch (Exception ex) {
            throw new IllegalStateException("load application.properties failed", ex);
        }
    }

    private String requireText(Properties properties, String key) {
        String value = trimToNull(properties.getProperty(key));
        if (value == null) {
            throw new IllegalStateException("missing required property: " + key);
        }
        return value;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void safeDeleteQueue(String queueName) {
        if (queueName == null || queueName.isBlank()) {
            return;
        }
        try {
            rabbitAdmin.deleteQueue(queueName);
        } catch (Exception ignore) {
        }
    }

    private void safeDeleteExchange(String targetExchange) {
        if (targetExchange == null || targetExchange.isBlank()) {
            return;
        }
        try {
            rabbitAdmin.deleteExchange(targetExchange);
        } catch (Exception ignore) {
        }
    }

    private Message waitForMessage(RabbitTemplate rabbitTemplate, String queueName, long timeoutMs) {
        long start = System.currentTimeMillis();
        while (System.currentTimeMillis() - start < timeoutMs) {
            Message message = rabbitTemplate.receive(queueName, 300);
            if (message != null) {
                return message;
            }
        }
        return null;
    }
}
