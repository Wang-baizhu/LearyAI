// Responsibility: Publish task creation messages to RabbitMQ.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.port.TaskMqPublisher;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.domain.model.StageExecution;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Component
public class RabbitTaskMqPublisher implements TaskMqPublisher {
    private final RabbitTemplate rabbitTemplate;
    private final ObjectMapper objectMapper;
    private final String exchangeName;
    private final String docProcessRoutingKey;
    private final String agentRunRoutingKey;
    private final String templatePluginPublishRoutingKey;

    public RabbitTaskMqPublisher(RabbitTemplate rabbitTemplate,
                                 ObjectMapper objectMapper,
                                 @Value("${task.mq.exchange:task.exchange}") String exchangeName,
                                 @Value("${task.mq.command.doc.routing-key:task.command.doc.process}") String docProcessRoutingKey,
                                 @Value("${task.mq.command.agent.routing-key:task.command.agent.run}") String agentRunRoutingKey,
                                 @Value("${task.mq.command.template-plugin.routing-key:task.command.template-plugin.publish}") String templatePluginPublishRoutingKey) {
        this.rabbitTemplate = rabbitTemplate;
        this.objectMapper = objectMapper;
        this.exchangeName = exchangeName;
        this.docProcessRoutingKey = docProcessRoutingKey;
        this.agentRunRoutingKey = agentRunRoutingKey;
        this.templatePluginPublishRoutingKey = templatePluginPublishRoutingKey;
    }

    @Override
    public void publishStageCommand(Task task, StageExecution stageExecution, Map<String, Object> stageInput) {
        if (stageExecution == null) {
            throw new BizException("KB-400", "stageExecution required");
        }
        publishCommand(task, stageExecution, stageInput, task == null ? null : task.getUserId());
    }

    @Override
    public void publishTaskCreated(Task task, Map<String, Object> stagePayload) {
        throw new BizException("KB-400", "publishTaskCreated deprecated");
    }

    @Override
    public void publishAgentRunCommand(Object command) {
        if (command == null) {
            throw new BizException("KB-400", "agent command required");
        }
        try {
            String body = objectMapper.writeValueAsString(command);
            rabbitTemplate.convertAndSend(exchangeName, agentRunRoutingKey, body);
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "mq payload serialize failed");
        }
    }

    private void publishCommand(Task task, StageExecution stageExecution, Map<String, Object> stagePayload, Long userId) {
        if (task == null) {
            throw new BizException("KB-400", "task required");
        }
        String taskType = normalizeRequired(stageExecution.getExecutorType(), "taskType required");
        Map<String, Object> envelope = new HashMap<>();
        envelope.put("messageId", UUID.randomUUID().toString());
        envelope.put("schemaVersion", "1.0");
        envelope.put("occurredAt", Instant.now().toString());
        envelope.put("traceId", UUID.randomUUID().toString());
        envelope.put("producer", "backend");
        envelope.put("projectId", normalizeNullable(task.getProjectId()));
        envelope.put("kbId", normalizeNullable(task.getKbId()));
        envelope.put("userId", userId);
        envelope.put("taskRecordId", stageExecution.getId());
        envelope.put("taskType", taskType);
        envelope.put("parentTaskRecordId", task.getTaskRecordId());
        envelope.put("stageRunKey", stageExecution.getStageKey());
        Map<String, Object> payload = new HashMap<>();
        payload.put("typeId", resolveTypeId(task, stagePayload));
        if (stagePayload != null && !stagePayload.isEmpty()) {
            payload.putAll(stagePayload);
        }
        envelope.put("payload", payload);
        try {
            String body = objectMapper.writeValueAsString(envelope);
            rabbitTemplate.convertAndSend(exchangeName, resolveRoutingKey(taskType), body);
        } catch (JsonProcessingException ex) {
            throw new BizException("KB-500", "mq payload serialize failed");
        }
    }

    private String resolveRoutingKey(String taskType) {
        return switch (taskType) {
            case TaskTypes.DOC -> docProcessRoutingKey;
            case TaskTypes.AGENT -> agentRunRoutingKey;
            case TaskTypes.TEMPLATE_PLUGIN_PUBLISH -> templatePluginPublishRoutingKey;
            default -> throw new BizException("KB-400", "unsupported taskType: " + taskType);
        };
    }

    private String normalizeRequired(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB-400", message);
        }
        return value.trim();
    }

    private String normalizeNullable(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private String resolveTypeId(Task task, Map<String, Object> stagePayload) {
        if (task != null && task.getTypeId() != null && !task.getTypeId().isBlank()) {
            return task.getTypeId().trim();
        }
        if (stagePayload == null) {
            return null;
        }
        Object docId = stagePayload.get("docId");
        if (docId instanceof String text && !text.isBlank()) {
            return text.trim();
        }
        return null;
    }
}
