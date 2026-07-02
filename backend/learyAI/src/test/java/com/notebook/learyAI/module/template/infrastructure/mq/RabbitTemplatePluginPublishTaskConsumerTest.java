// Responsibility: Verify template plugin publish MQ consumer failure handling.
package com.notebook.learyAI.module.template.infrastructure.mq;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.template.application.TemplatePluginManagementAppService;
import com.notebook.learyAI.shared.exception.BizException;
import com.rabbitmq.client.Channel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageBuilder;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.Map;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RabbitTemplatePluginPublishTaskConsumerTest {
    @Mock
    private TemplatePluginManagementAppService appService;
    @Mock
    private TemplatePluginPublishTaskStatusPublisher taskStatusPublisher;
    @Mock
    private RabbitTemplate rabbitTemplate;
    @Mock
    private Channel channel;

    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    @DisplayName("taskType 不匹配时应拒绝消息且不执行校验")
    void consume_shouldRejectWhenTaskTypeMismatch() throws Exception {
        RabbitTemplatePluginPublishTaskConsumer consumer = newConsumer(3);
        Message message = buildMessage(Map.of("taskType", "agent"), 13L);

        consumer.consume(message, channel);

        verify(channel).basicReject(13L, false);
        verify(channel, never()).basicAck(13L, false);
        verify(appService, never()).executePublishValidation(any());
        verify(taskStatusPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("kbId 不匹配时应拒绝消息且不执行校验")
    void consume_shouldRejectWhenKbIdMismatch() throws Exception {
        RabbitTemplatePluginPublishTaskConsumer consumer = newConsumer(3);
        Message message = buildMessage(Map.of("kbId", "kb-1"), 14L);

        consumer.consume(message, channel);

        verify(channel).basicReject(14L, false);
        verify(channel, never()).basicAck(14L, false);
        verify(appService, never()).executePublishValidation(any());
        verify(taskStatusPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("stageRunKey 不匹配时应拒绝消息且不执行校验")
    void consume_shouldRejectWhenStageRunKeyMismatch() throws Exception {
        RabbitTemplatePluginPublishTaskConsumer consumer = newConsumer(3);
        Message message = buildMessage(Map.of("stageRunKey", "template-plugin-publish:other"), 15L);

        consumer.consume(message, channel);

        verify(channel).basicReject(15L, false);
        verify(channel, never()).basicAck(15L, false);
        verify(appService, never()).executePublishValidation(any());
        verify(taskStatusPublisher, never()).publish(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("不可重试业务异常应回写 FAILED 状态并 ack 消息")
    void consume_shouldPublishFailedStatusForNonRetryableBizException() throws Exception {
        RabbitTemplatePluginPublishTaskConsumer consumer = newConsumer(3);
        Message message = buildMessage(Map.of(
                "payload", Map.of(
                        "pluginId", "plugin-1",
                        "objectKey", "staging/dist.zip"
                )
        ), 11L);
        when(appService.executePublishValidation(any()))
                .thenThrow(new BizException("TEMPLATE-400", "plugin version already published"));

        consumer.consume(message, channel);

        verify(taskStatusPublisher).publish(
                eq("project-1"),
                eq("template-plugin-publish"),
                eq(1001L),
                eq(2001L),
                eq(1001L),
                eq("template-plugin-publish:validate"),
                eq("template_plugin_publish"),
                eq(com.notebook.learyAI.module.task.domain.model.TaskStatus.FAILED),
                eq("status_change"),
                eq("plugin version already published"),
                eq(null),
                eq("TEMPLATE-400"),
                eq("plugin version already published")
        );
        verify(channel).basicAck(11L, false);
        verify(channel, never()).basicReject(11L, false);
        verify(rabbitTemplate, never()).send(any(), any(), any(Message.class));
    }

    @Test
    @DisplayName("重试耗尽后应落失败状态并 ack 消息")
    void consume_shouldMarkFailedWhenRetryExhausted() throws Exception {
        RabbitTemplatePluginPublishTaskConsumer consumer = newConsumer(1);
        Message message = MessageBuilder.withBody(objectMapper.writeValueAsBytes(buildEnvelope(Map.of(
                "payload", Map.of(
                        "pluginId", "123e4567-e89b-12d3-a456-426614174000",
                        "objectKey", "template-plugins-staging/123e4567-e89b-12d3-a456-426614174000/dist.zip"
                )
        ))))
                .setHeader("x-retry-count", 1)
                .build();
        message.getMessageProperties().setDeliveryTag(12L);
        when(appService.executePublishValidation(any()))
                .thenThrow(new TemplatePluginManagementAppService.RetryablePublishValidationException(
                        "retry required",
                        new IllegalStateException("storage temporarily unavailable")
                ));
        when(appService.markPublishValidationRetryExhausted(any(), any()))
                .thenReturn(TemplatePluginManagementAppService.PublishValidationExecutionResult.failed(Map.of(), "failed"));

        consumer.consume(message, channel);

        verify(appService).markPublishValidationRetryExhausted(
                any(),
                contains("模板插件服务端校验重试耗尽")
        );
        verify(taskStatusPublisher).publish(
                eq("project-1"),
                eq("template-plugin-publish"),
                eq(1001L),
                eq(2001L),
                eq(1001L),
                eq("template-plugin-publish:validate"),
                eq("template_plugin_publish"),
                eq(com.notebook.learyAI.module.task.domain.model.TaskStatus.FAILED),
                eq("status_change"),
                contains("模板插件服务端校验重试耗尽"),
                eq(null),
                eq("TEMPLATE-500"),
                contains("模板插件服务端校验重试耗尽")
        );
        verify(channel).basicAck(12L, false);
        verify(channel, never()).basicReject(12L, false);
    }

    private RabbitTemplatePluginPublishTaskConsumer newConsumer(int maxRetryCount) {
        return new RabbitTemplatePluginPublishTaskConsumer(
                objectMapper,
                appService,
                taskStatusPublisher,
                rabbitTemplate,
                "task.exchange",
                "task.command.template-plugin.publish.retry",
                maxRetryCount
        );
    }

    private Message buildMessage(Map<String, Object> overrides, long deliveryTag) throws Exception {
        Message message = MessageBuilder.withBody(objectMapper.writeValueAsBytes(buildEnvelope(overrides))).build();
        message.getMessageProperties().setDeliveryTag(deliveryTag);
        return message;
    }

    private Map<String, Object> buildEnvelope(Map<String, Object> overrides) {
        java.util.LinkedHashMap<String, Object> envelope = new java.util.LinkedHashMap<>();
        envelope.put("projectId", "project-1");
        envelope.put("kbId", "template-plugin-publish");
        envelope.put("userId", 1001L);
        envelope.put("taskRecordId", 2001L);
        envelope.put("parentTaskRecordId", 1001L);
        envelope.put("taskType", "template_plugin_publish");
        envelope.put("stageRunKey", "template-plugin-publish:validate");
        envelope.put("payload", Map.of(
                "pluginId", "123e4567-e89b-12d3-a456-426614174000",
                "objectKey", "template-plugins-staging/123e4567-e89b-12d3-a456-426614174000/dist.zip"
        ));
        envelope.putAll(overrides);
        return envelope;
    }
}
