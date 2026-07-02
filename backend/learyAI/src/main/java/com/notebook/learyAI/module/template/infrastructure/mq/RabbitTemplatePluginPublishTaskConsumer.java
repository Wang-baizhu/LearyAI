// Responsibility: Consume task.command.template-plugin.publish and execute template plugin validation.
package com.notebook.learyAI.module.template.infrastructure.mq;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.template.application.TemplatePluginManagementAppService;
import com.notebook.learyAI.shared.exception.BizException;
import com.rabbitmq.client.Channel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class RabbitTemplatePluginPublishTaskConsumer {
    private static final Logger log = LoggerFactory.getLogger(RabbitTemplatePluginPublishTaskConsumer.class);
    private static final String RETRY_COUNT_HEADER = "x-retry-count";
    private static final String TEMPLATE_PLUGIN_PUBLISH_KB_ID = "template-plugin-publish";

    private final ObjectMapper objectMapper;
    private final TemplatePluginManagementAppService appService;
    private final TemplatePluginPublishTaskStatusPublisher taskStatusPublisher;
    private final RabbitTemplate rabbitTemplate;
    private final String exchangeName;
    private final String retryRoutingKey;
    private final int maxRetryCount;

    public RabbitTemplatePluginPublishTaskConsumer(ObjectMapper objectMapper,
                                                   TemplatePluginManagementAppService appService,
                                                   TemplatePluginPublishTaskStatusPublisher taskStatusPublisher,
                                                   RabbitTemplate rabbitTemplate,
                                                   @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                                   @Value("${task.mq.command.template-plugin.retry-routing-key:task.command.template-plugin.publish.retry}") String retryRoutingKey,
                                                   @Value("${task.mq.command.template-plugin.max-retries:3}") int maxRetryCount) {
        this.objectMapper = objectMapper;
        this.appService = appService;
        this.taskStatusPublisher = taskStatusPublisher;
        this.rabbitTemplate = rabbitTemplate;
        this.exchangeName = exchangeName;
        this.retryRoutingKey = retryRoutingKey;
        this.maxRetryCount = Math.max(0, maxRetryCount);
    }

    @RabbitListener(queues = "${task.mq.command.template-plugin.queue:task.template-plugin.publish.queue}", ackMode = "MANUAL")
    public void consume(Message message, Channel channel) throws Exception {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        try {
            TaskCommandEnvelope command = objectMapper.readValue(body, TaskCommandEnvelope.class);
            validateCommandEnvelope(command);
            TemplatePluginManagementAppService.PublishValidationExecutionResult result =
                    appService.executePublishValidation(new TemplatePluginManagementAppService.PublishValidationExecutionCommand(
                            requiredText(readPayloadText(command.payload(), "pluginId"), "pluginId required"),
                            requiredText(readPayloadText(command.payload(), "objectKey"), "objectKey required")
                    ));
            if (result.passed()) {
                taskStatusPublisher.publish(
                        command.projectId(),
                        command.kbId(),
                        command.userId(),
                        command.taskRecordId(),
                        command.parentTaskRecordId(),
                        command.stageRunKey(),
                        command.taskType(),
                        TaskStatus.DONE,
                        "status_change",
                        "模板插件发布完成",
                        result.result(),
                        null,
                        null
                );
            } else {
                taskStatusPublisher.publish(
                        command.projectId(),
                        command.kbId(),
                        command.userId(),
                        command.taskRecordId(),
                        command.parentTaskRecordId(),
                        command.stageRunKey(),
                        command.taskType(),
                        TaskStatus.FAILED,
                        "status_change",
                        result.failureMessage(),
                        result.result(),
                        "TEMPLATE-400",
                        result.failureMessage()
                );
            }
            channel.basicAck(deliveryTag, false);
        } catch (JsonProcessingException ex) {
            channel.basicReject(deliveryTag, false);
        } catch (InvalidEnvelopeException ex) {
            log.warn("template plugin publish task rejected: error={}, body={}", ex.getMessage(), body);
            channel.basicReject(deliveryTag, false);
        } catch (BizException ex) {
            if (isNonRetryable(ex)) {
                publishFailedStatus(commandFromBody(body), ex.getMessage());
                log.warn("template plugin publish task rejected: error={}, body={}", ex.getMessage(), body);
                channel.basicAck(deliveryTag, false);
                return;
            }
            routeToRetryOrDlq(message, channel, deliveryTag, ex);
        } catch (RuntimeException ex) {
            routeToRetryOrDlq(message, channel, deliveryTag, ex);
        }
    }

    private void routeToRetryOrDlq(Message message, Channel channel, long deliveryTag, Exception ex) throws Exception {
        int retryCount = resolveRetryCount(message);
        if (retryCount >= maxRetryCount) {
            TaskCommandEnvelope command = commandFromBody(new String(message.getBody(), StandardCharsets.UTF_8));
            String failureMessage = buildRetryExhaustedMessage(ex);
            if (command != null) {
                appService.markPublishValidationRetryExhausted(
                        new TemplatePluginManagementAppService.PublishValidationExecutionCommand(
                                requiredText(readPayloadText(command.payload(), "pluginId"), "pluginId required"),
                                requiredText(readPayloadText(command.payload(), "objectKey"), "objectKey required")
                        ),
                        failureMessage
                );
                publishFailedStatus(command, failureMessage, "TEMPLATE-500", failureMessage);
            }
            log.error("template plugin publish retries exhausted: error={}", ex.getMessage(), ex);
            channel.basicAck(deliveryTag, false);
            return;
        }
        Message retryMessage = MessageBuilder.fromMessage(message)
                .setHeader(RETRY_COUNT_HEADER, retryCount + 1)
                .build();
        rabbitTemplate.send(exchangeName, retryRoutingKey, retryMessage);
        channel.basicAck(deliveryTag, false);
    }

    private int resolveRetryCount(Message message) {
        Object value = message.getMessageProperties().getHeaders().get(RETRY_COUNT_HEADER);
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text);
            } catch (NumberFormatException ignore) {
                return 0;
            }
        }
        return 0;
    }

    private boolean isNonRetryable(BizException ex) {
        return "TEMPLATE-400".equals(ex.getCode()) || "TEMPLATE-404".equals(ex.getCode());
    }

    private void publishFailedStatus(TaskCommandEnvelope command, String errorMessage) {
        publishFailedStatus(command, errorMessage, "TEMPLATE-400", errorMessage);
    }

    private void publishFailedStatus(TaskCommandEnvelope command,
                                     String info,
                                     String errorCode,
                                     String errorMessage) {
        if (command == null) {
            return;
        }
        taskStatusPublisher.publish(
                command.projectId(),
                command.kbId(),
                command.userId(),
                command.taskRecordId(),
                command.parentTaskRecordId(),
                command.stageRunKey(),
                command.taskType(),
                TaskStatus.FAILED,
                "status_change",
                info,
                null,
                errorCode,
                errorMessage
        );
    }

    private void validateCommandEnvelope(TaskCommandEnvelope command) {
        if (command == null) {
            throw new InvalidEnvelopeException("command envelope required");
        }
        if (!TaskTypes.TEMPLATE_PLUGIN_PUBLISH.equals(command.taskType())) {
            throw new InvalidEnvelopeException("taskType mismatch");
        }
        if (!TEMPLATE_PLUGIN_PUBLISH_KB_ID.equals(command.kbId())) {
            throw new InvalidEnvelopeException("kbId mismatch");
        }
        if (!TaskWorkflowDefinitions.TEMPLATE_PLUGIN_PUBLISH_STAGE_RUN_KEY.equals(command.stageRunKey())) {
            throw new InvalidEnvelopeException("stageRunKey mismatch");
        }
    }

    private String buildRetryExhaustedMessage(Exception ex) {
        String detail = ex == null || ex.getMessage() == null || ex.getMessage().isBlank()
                ? "unknown error"
                : ex.getMessage().trim();
        return "模板插件服务端校验重试耗尽: " + detail;
    }

    private TaskCommandEnvelope commandFromBody(String body) {
        try {
            return objectMapper.readValue(body, TaskCommandEnvelope.class);
        } catch (JsonProcessingException ex) {
            log.warn("template plugin publish task body parse failed when publishing failure status");
            return null;
        }
    }

    private String readPayloadText(Map<String, Object> payload, String key) {
        if (payload == null) {
            return null;
        }
        Object value = payload.get(key);
        return value == null ? null : String.valueOf(value);
    }

    private String requiredText(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("TEMPLATE-400", message);
        }
        return value.trim();
    }

    @SuppressWarnings("unused")
    private record TaskCommandEnvelope(String messageId,
                                       String schemaVersion,
                                       String occurredAt,
                                       String traceId,
                                       String producer,
                                       String projectId,
                                       String kbId,
                                       Long userId,
                                       Long taskRecordId,
                                       String taskType,
                                       Long parentTaskRecordId,
                                       String stageRunKey,
                                       Map<String, Object> payload) {
    }

    private static final class InvalidEnvelopeException extends RuntimeException {
        private InvalidEnvelopeException(String message) {
            super(message);
        }
    }
}
