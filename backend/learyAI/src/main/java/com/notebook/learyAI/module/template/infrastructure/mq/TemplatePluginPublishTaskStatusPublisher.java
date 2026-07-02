// Responsibility: Publish template plugin validation stage status events to task.event.status.changed.
package com.notebook.learyAI.module.template.infrastructure.mq;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class TemplatePluginPublishTaskStatusPublisher {
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final String exchangeName;
    private final String routingKey;

    public TemplatePluginPublishTaskStatusPublisher(RabbitTemplate rabbitTemplate,
                                                    ObjectMapper objectMapper,
                                                    @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                                    @Value("${task.mq.event.status.routing-key:task.event.status.changed}") String routingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.exchangeName = exchangeName;
        this.routingKey = routingKey;
    }

    public void publish(String projectId,
                        String kbId,
                        Long userId,
                        Long stageExecutionId,
                        Long parentTaskRecordId,
                        String stageRunKey,
                        String taskType,
                        TaskStatus status,
                        String changeType,
                        String info,
                        Map<String, Object> result,
                        String errorCode,
                        String errorMessage) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("messageId", UUID.randomUUID().toString());
        payload.put("schemaVersion", "1.0");
        payload.put("occurredAt", Instant.now().toString());
        payload.put("traceId", UUID.randomUUID().toString());
        payload.put("producer", "backend");
        payload.put("projectId", projectId);
        payload.put("kbId", kbId);
        payload.put("userId", userId);
        payload.put("taskRecordId", stageExecutionId);
        payload.put("parentTaskRecordId", parentTaskRecordId);
        payload.put("taskType", taskType);
        payload.put("stageRunKey", stageRunKey);
        payload.put("status", status.name());
        payload.put("changeType", changeType == null ? "status_change" : changeType);
        payload.put("info", info);
        payload.put("result", result);
        payload.put("errorCode", errorCode);
        payload.put("errorMessage", errorMessage);
        try {
            rabbitTemplate.convertAndSend(exchangeName, routingKey, objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException ex) {
            throw new BizException("TEMPLATE-500", "mq payload serialize failed");
        }
    }
}
