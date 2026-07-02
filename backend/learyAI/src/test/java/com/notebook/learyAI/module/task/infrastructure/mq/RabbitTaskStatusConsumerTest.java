// Responsibility: Verify task.status Rabbit consumer ack/retry/dlq behaviors without real broker.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.status.TaskStatusConsumeResult;
import com.notebook.learyAI.module.task.application.status.TaskStatusMqConsumerAppService;
import com.notebook.learyAI.shared.exception.BizException;
import com.rabbitmq.client.Channel;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RabbitTaskStatusConsumerTest {
    @Mock
    private ObjectMapper objectMapper;
    @Mock
    private TaskStatusMqConsumerAppService appService;
    @Mock
    private RabbitTemplate rabbitTemplate;
    @Mock
    private Channel channel;

    @Test
    @DisplayName("consume: 成功消费应 ack")
    void consume_whenSuccess_shouldAck() throws Exception {
        RabbitTaskStatusConsumer consumer = new RabbitTaskStatusConsumer(
                objectMapper, appService, rabbitTemplate, "task.exchange", "task.event.status.changed.retry", 3
        );
        Message message = buildMessage("{\"messageId\":\"evt_ok\"}", 7L, null);
        TaskStatusEvent event = new TaskStatusEvent();
        event.setMessageId("evt_ok");
        event.setProjectId("b25b3db6-3a3a-46ac-8117-06dc938acaed");
        event.setKbId("kb-1");
        event.setTaskRecordId(8L);
        event.setTaskType("doc");
        event.setStageRunKey("doc:main");
        event.setStatus("PROCESSING");
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class))).thenReturn(event);
        when(appService.consume(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(TaskStatusConsumeResult.PROCESSED);

        consumer.consume(message, channel);

        verify(channel).basicAck(7L, false);
        verify(channel, never()).basicReject(anyLong(), eq(false));
        verify(rabbitTemplate, never()).send(any(String.class), any(String.class), any(Message.class));
    }

    @Test
    @DisplayName("consume: KB-400 应直接 reject 到 DLQ")
    void consume_whenKb400_shouldReject() throws Exception {
        RabbitTaskStatusConsumer consumer = new RabbitTaskStatusConsumer(
                objectMapper, appService, rabbitTemplate, "task.exchange", "task.event.status.changed.retry", 3
        );
        Message message = buildMessage("{\"messageId\":\"evt_bad\"}", 8L, null);
        TaskStatusEvent event = new TaskStatusEvent();
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class))).thenReturn(event);
        when(appService.consume(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new BizException("KB-400", "invalid message"));

        consumer.consume(message, channel);

        verify(channel).basicReject(8L, false);
        verify(channel, never()).basicAck(anyLong(), eq(false));
        verify(rabbitTemplate, never()).send(any(String.class), any(String.class), any(Message.class));
    }

    @Test
    @DisplayName("consume: 可重试异常应发送到 retry 队列并 ack 原消息")
    void consume_whenRetryable_shouldPublishRetryAndAck() throws Exception {
        RabbitTaskStatusConsumer consumer = new RabbitTaskStatusConsumer(
                objectMapper, appService, rabbitTemplate, "task.exchange", "task.event.status.changed.retry", 3
        );
        Message message = buildMessage("{\"messageId\":\"evt_retry\"}", 9L, null);
        TaskStatusEvent event = new TaskStatusEvent();
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class))).thenReturn(event);
        when(appService.consume(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new BizException("KB-500", "db temporary error"));

        consumer.consume(message, channel);

        ArgumentCaptor<Message> retryCaptor = ArgumentCaptor.forClass(Message.class);
        verify(rabbitTemplate).send(eq("task.exchange"), eq("task.event.status.changed.retry"), retryCaptor.capture());
        Object retryCount = retryCaptor.getValue().getMessageProperties().getHeaders().get("x-retry-count");
        assertEquals(1, retryCount);
        verify(channel).basicAck(9L, false);
        verify(channel, never()).basicReject(anyLong(), eq(false));
    }

    @Test
    @DisplayName("consume: 超过重试上限应 reject 到 DLQ")
    void consume_whenRetryExhausted_shouldReject() throws Exception {
        RabbitTaskStatusConsumer consumer = new RabbitTaskStatusConsumer(
                objectMapper, appService, rabbitTemplate, "task.exchange", "task.event.status.changed.retry", 3
        );
        Message message = buildMessage("{\"messageId\":\"evt_exhausted\"}", 10L, 3);
        TaskStatusEvent event = new TaskStatusEvent();
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class))).thenReturn(event);
        when(appService.consume(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenThrow(new BizException("KB-500", "db temporary error"));

        consumer.consume(message, channel);

        verify(channel).basicReject(10L, false);
        verify(channel, never()).basicAck(anyLong(), eq(false));
        verify(rabbitTemplate, never()).send(any(String.class), any(String.class), any(Message.class));
    }

    @Test
    @DisplayName("consume: JSON 解析失败应直接 reject 到 DLQ")
    void consume_whenJsonInvalid_shouldReject() throws Exception {
        RabbitTaskStatusConsumer consumer = new RabbitTaskStatusConsumer(
                objectMapper, appService, rabbitTemplate, "task.exchange", "task.event.status.changed.retry", 3
        );
        Message message = buildMessage("{bad-json}", 11L, null);
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class)))
                .thenThrow(new JsonProcessingException("invalid json") {});

        consumer.consume(message, channel);

        verify(channel).basicReject(11L, false);
        verify(channel, never()).basicAck(anyLong(), eq(false));
        verify(rabbitTemplate, never()).send(any(String.class), any(String.class), any(Message.class));
    }

    private Message buildMessage(String body, long deliveryTag, Integer retryCount) {
        MessageProperties properties = new MessageProperties();
        properties.setDeliveryTag(deliveryTag);
        if (retryCount != null) {
            properties.setHeader("x-retry-count", retryCount);
        }
        return new Message(body.getBytes(StandardCharsets.UTF_8), properties);
    }
}
