// Responsibility: Persist and deduplicate task DLQ incidents before compensation.
package com.notebook.learyAI.module.task.application.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import com.notebook.learyAI.module.task.domain.repository.TaskDlqIncidentRepository;
import com.notebook.learyAI.module.task.infrastructure.mq.TaskCommandEnvelope;
import com.notebook.learyAI.module.task.infrastructure.mq.TaskStatusEvent;
import org.springframework.amqp.core.Message;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;

@Service
public class TaskDlqIncidentAppService {
    private final TaskDlqIncidentRepository repository;
    private final ObjectMapper objectMapper;

    public TaskDlqIncidentAppService(TaskDlqIncidentRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public TaskDlqIncident recordCommandIncident(TaskCommandEnvelope command, Message message, String errorMessage) {
        return recordIncident(
                resolveMessageId(command == null ? null : command.getMessageId(), message),
                resolveQueue(message),
                resolveRoutingKey(message),
                "COMMAND",
                command == null ? null : command.getTaskRecordId(),
                command == null ? null : command.getParentTaskRecordId(),
                command == null ? null : normalizeText(command.getProjectId()),
                command == null ? null : normalizeText(command.getKbId()),
                command == null ? null : normalizeText(command.getStageRunKey()),
                command == null ? null : normalizeText(command.getTaskType()),
                serializePayload(command),
                errorMessage,
                resolveRetryCount(message)
        );
    }

    @Transactional
    public TaskDlqIncident recordStatusIncident(TaskStatusEvent event, Message message, String errorMessage) {
        return recordIncident(
                resolveMessageId(event == null ? null : event.getMessageId(), message),
                resolveQueue(message),
                resolveRoutingKey(message),
                "STATUS",
                event == null ? null : event.getTaskRecordId(),
                event == null ? null : event.getParentTaskRecordId(),
                event == null ? null : normalizeText(event.getProjectId()),
                event == null ? null : normalizeText(event.getKbId()),
                event == null ? null : normalizeText(event.getStageRunKey()),
                event == null ? null : normalizeText(event.getTaskType()),
                serializePayload(event),
                errorMessage,
                resolveRetryCount(message)
        );
    }

    @Transactional
    public TaskDlqIncident markCompensated(TaskDlqIncident incident, String action) {
        if (incident == null || "COMPENSATED".equals(incident.getIncidentStatus())) {
            return incident;
        }
        return repository.save(incident.withCompensation(action, Instant.now()));
    }

    @Transactional
    public TaskDlqIncident markCompensationFailed(TaskDlqIncident incident, String action, String errorMessage) {
        if (incident == null) {
            return null;
        }
        return repository.save(incident.withCompensationFailure(action, normalizeText(errorMessage), Instant.now()));
    }

    private TaskDlqIncident recordIncident(String messageId,
                                           String sourceQueue,
                                           String sourceRoutingKey,
                                           String dlqType,
                                           Long taskRecordId,
                                           Long parentTaskRecordId,
                                           String projectId,
                                           String kbId,
                                           String stageRunKey,
                                           String taskType,
                                           String payloadJson,
                                           String errorMessage,
                                           Integer retryCount) {
        return repository.findByMessageIdAndSourceQueue(messageId, sourceQueue)
                .orElseGet(() -> repository.save(TaskDlqIncident.newOpenIncident(
                        messageId,
                        sourceQueue,
                        sourceRoutingKey,
                        dlqType,
                        taskRecordId,
                        parentTaskRecordId,
                        projectId,
                        kbId,
                        stageRunKey,
                        taskType,
                        payloadJson,
                        normalizeText(errorMessage),
                        retryCount,
                        Instant.now()
                )));
    }

    private String resolveQueue(Message message) {
        if (message == null || message.getMessageProperties() == null) {
            return "unknown";
        }
        return normalizeText(message.getMessageProperties().getConsumerQueue()) == null
                ? "unknown"
                : normalizeText(message.getMessageProperties().getConsumerQueue());
    }

    private String resolveRoutingKey(Message message) {
        if (message == null || message.getMessageProperties() == null) {
            return null;
        }
        return normalizeText(message.getMessageProperties().getReceivedRoutingKey());
    }

    private String resolveMessageId(String preferred, Message message) {
        String normalized = normalizeText(preferred);
        if (normalized != null) {
            return normalized;
        }
        return "raw:" + hashBody(message);
    }

    private String hashBody(Message message) {
        byte[] body = message == null || message.getBody() == null ? new byte[0] : message.getBody();
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(body));
        } catch (NoSuchAlgorithmException ex) {
            return Integer.toHexString(new String(body, StandardCharsets.UTF_8).hashCode());
        }
    }

    private Integer resolveRetryCount(Message message) {
        if (message == null || message.getMessageProperties() == null) {
            return 0;
        }
        Object value = message.getMessageProperties().getHeaders().get("x-retry-count");
        if (value instanceof Number number) {
            return number.intValue();
        }
        if (value instanceof String text) {
            try {
                return Integer.parseInt(text.trim());
            } catch (NumberFormatException ignore) {
                return 0;
            }
        }
        return 0;
    }

    private String serializePayload(Object payload) {
        if (payload == null) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException ex) {
            return null;
        }
    }

    private String normalizeText(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}
