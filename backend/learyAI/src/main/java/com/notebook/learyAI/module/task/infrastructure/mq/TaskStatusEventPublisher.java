// Responsibility: Publish task.event.status.changed compensation events to RabbitMQ.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.UUID;

@Component
public class TaskStatusEventPublisher {
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final String exchangeName;
    private final String statusRoutingKey;

    public TaskStatusEventPublisher(RabbitTemplate rabbitTemplate,
                                    ObjectMapper objectMapper,
                                    @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                    @Value("${task.mq.event.status.routing-key:task.event.status.changed}") String statusRoutingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.exchangeName = exchangeName;
        this.statusRoutingKey = statusRoutingKey;
    }

    public void publishFailedFromCommandDlq(TaskCommandEnvelope command,
                                            String errorCode,
                                            String errorMessage,
                                            String changeType) {
        if (command == null) {
            throw new BizException("KB-400", "command required");
        }
        TaskStatusEvent event = new TaskStatusEvent();
        event.setMessageId(UUID.randomUUID().toString());
        event.setSchemaVersion("1.0");
        event.setOccurredAt(Instant.now().toString());
        event.setTraceId(UUID.randomUUID().toString());
        event.setProducer("backend-dlq");
        event.setProjectId(command.getProjectId());
        event.setKbId(command.getKbId());
        event.setUserId(command.getUserId());
        event.setTaskRecordId(command.getTaskRecordId());
        event.setTaskType(command.getTaskType());
        event.setParentTaskRecordId(command.getParentTaskRecordId());
        event.setStageRunKey(command.getStageRunKey());
        event.setStatus("FAILED");
        event.setChangeType(changeType);
        event.setInfo(errorMessage);
        event.setErrorCode(errorCode);
        event.setErrorMessage(errorMessage);
        publish(event);
    }

    public void publish(TaskStatusEvent event) {
        if (event == null) {
            throw new BizException("KB-400", "taskStatusEvent required");
        }
        try {
            rabbitTemplate.convertAndSend(exchangeName, statusRoutingKey, objectMapper.writeValueAsString(event));
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "mq payload serialize failed");
        }
    }
}
