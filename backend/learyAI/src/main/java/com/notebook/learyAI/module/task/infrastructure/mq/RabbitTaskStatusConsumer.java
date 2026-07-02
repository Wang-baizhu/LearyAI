// Responsibility: Consume task.event.status.changed messages with retry routing and DLQ fallback.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.status.TaskStatusConsumeResult;
import com.notebook.learyAI.module.task.application.status.TaskStatusMqConsumerAppService;
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

@Component
public class RabbitTaskStatusConsumer {
    private static final Logger log = LoggerFactory.getLogger(RabbitTaskStatusConsumer.class);
    private static final String RETRY_COUNT_HEADER = "x-retry-count";

    private final ObjectMapper objectMapper;
    private final TaskStatusMqConsumerAppService appService;
    private final RabbitTemplate rabbitTemplate;
    private final String exchangeName;
    private final String retryRoutingKey;
    private final int maxRetryCount;

    public RabbitTaskStatusConsumer(ObjectMapper objectMapper,
                                    TaskStatusMqConsumerAppService appService,
                                    RabbitTemplate rabbitTemplate,
                                    @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                    @Value("${task.mq.event.status.retry-routing-key:task.event.status.changed.retry}") String retryRoutingKey,
                                    @Value("${task.mq.event.status.max-retries:3}") int maxRetryCount) {
        this.objectMapper = objectMapper;
        this.appService = appService;
        this.rabbitTemplate = rabbitTemplate;
        this.exchangeName = exchangeName;
        this.retryRoutingKey = retryRoutingKey;
        this.maxRetryCount = Math.max(0, maxRetryCount);
    }

    @RabbitListener(queues = "${task.mq.event.status.queue:task.status.changed.queue}", ackMode = "MANUAL")
    public void consume(Message message, Channel channel) throws Exception {
        long deliveryTag = message.getMessageProperties().getDeliveryTag();
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        try {
            TaskStatusEvent event = objectMapper.readValue(body, TaskStatusEvent.class);
            TaskStatusConsumeResult result = appService.consume(event.getMessageId(), event.getProjectId(),
                    event.getKbId(), event.getTaskRecordId(), event.getTaskType(),
                    event.getStatus(), event.getChangeType(), event.getResult(), event.getInfo(),
                    event.getErrorCode(), event.getErrorMessage(), event.getStageRunKey(), event.getUserId());
            if (result == TaskStatusConsumeResult.DUPLICATE) {
                log.info("task.event.status.changed duplicated and skipped: messageId={}, projectId={}, kbId={}, taskRecordId={}",
                        event.getMessageId(), event.getProjectId(), event.getKbId(), event.getTaskRecordId());
            } else {
                log.info("task.event.status.changed consumed: messageId={}, projectId={}, kbId={}, taskRecordId={}, taskType={}, status={}",
                        event.getMessageId(), event.getProjectId(), event.getKbId(), event.getTaskRecordId(), event.getTaskType(),
                        event.getStatus());
            }
            channel.basicAck(deliveryTag, false);
        } catch (JsonProcessingException | BizException ex) {
            if (isNonRetryable(ex)) {
                log.warn("task.event.status.changed rejected as non-retryable: error={}, body={}",
                        ex.getMessage(), body);
                channel.basicReject(deliveryTag, false);
                return;
            }
            routeToRetryOrDlq(message, channel, deliveryTag, ex);
        } catch (Exception ex) {
            routeToRetryOrDlq(message, channel, deliveryTag, ex);
        }
    }

    private void routeToRetryOrDlq(Message message, Channel channel, long deliveryTag, Exception ex) throws Exception {
        int retryCount = resolveRetryCount(message);
        if (retryCount >= maxRetryCount) {
            log.error("task.event.status.changed retries exhausted, route to DLQ: retryCount={}, error={}",
                    retryCount, ex.getMessage(), ex);
            channel.basicReject(deliveryTag, false);
            return;
        }
        int nextRetryCount = retryCount + 1;
        Message retryMessage = MessageBuilder.fromMessage(message)
                .setHeader(RETRY_COUNT_HEADER, nextRetryCount)
                .build();
        rabbitTemplate.send(exchangeName, retryRoutingKey, retryMessage);
        log.warn("task.event.status.changed requeued via retry queue: retryCount={}, nextRetryCount={}, error={}",
                retryCount, nextRetryCount, ex.getMessage());
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

    private boolean isNonRetryable(Exception ex) {
        if (ex instanceof JsonProcessingException) {
            return true;
        }
        if (!(ex instanceof BizException bizException)) {
            return false;
        }
        String code = bizException.getCode();
        return "KB-400".equals(code) || "KB-404".equals(code);
    }
}
