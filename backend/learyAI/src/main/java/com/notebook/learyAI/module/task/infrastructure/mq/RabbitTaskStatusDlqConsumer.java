// Responsibility: Consume task.status DLQ messages, persist incidents, and force FAILED compensation.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.service.TaskDlqIncidentAppService;
import com.notebook.learyAI.module.task.application.status.TaskStatusDlqCompensationAppService;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;

@Component
public class RabbitTaskStatusDlqConsumer {
    private static final Logger log = LoggerFactory.getLogger(RabbitTaskStatusDlqConsumer.class);
    private static final String COMPENSATION_ACTION_SUCCESS = "force_stage_failed";
    private static final String COMPENSATION_ACTION_FAILED = "force_stage_failed_failed";

    private final ObjectMapper objectMapper;
    private final TaskDlqIncidentAppService incidentAppService;
    private final TaskStatusDlqCompensationAppService compensationAppService;

    public RabbitTaskStatusDlqConsumer(ObjectMapper objectMapper,
                                       TaskDlqIncidentAppService incidentAppService,
                                       TaskStatusDlqCompensationAppService compensationAppService) {
        this.objectMapper = objectMapper;
        this.incidentAppService = incidentAppService;
        this.compensationAppService = compensationAppService;
    }

    @RabbitListener(queues = "${task.mq.event.status.dlq:task.status.changed.dlq}")
    public void consume(Message message) {
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        TaskDlqIncident incident = null;
        String baseErrorMessage = buildFallbackErrorMessage(message);
        try {
            TaskStatusEvent event = objectMapper.readValue(body, TaskStatusEvent.class);
            baseErrorMessage = resolveErrorMessage(event, message);
            incident = incidentAppService.recordStatusIncident(event, message, baseErrorMessage);
            if ("COMPENSATED".equals(incident.getIncidentStatus())) {
                return;
            }
            boolean compensated = compensationAppService.compensate(event, baseErrorMessage);
            if (compensated) {
                incidentAppService.markCompensated(incident, COMPENSATION_ACTION_SUCCESS);
            }
        } catch (Exception ex) {
            String incidentError = baseErrorMessage + "; parseError=" + ex.getMessage();
            if (incident != null) {
                incidentAppService.markCompensationFailed(incident, COMPENSATION_ACTION_FAILED, incidentError);
            } else {
                TaskDlqIncident rawIncident = incidentAppService.recordStatusIncident(null, message, incidentError);
                incidentAppService.markCompensationFailed(rawIncident, COMPENSATION_ACTION_FAILED, incidentError);
            }
            log.error("task.status DLQ compensation failed: queue={}, error={}, body={}",
                    message.getMessageProperties().getConsumerQueue(), ex.getMessage(), body, ex);
        }
    }

    private String resolveErrorMessage(TaskStatusEvent event, Message message) {
        if (event != null && event.getErrorMessage() != null && !event.getErrorMessage().isBlank()) {
            return event.getErrorMessage().trim();
        }
        if (event != null && event.getInfo() != null && !event.getInfo().isBlank()) {
            return event.getInfo().trim();
        }
        return buildFallbackErrorMessage(message);
    }

    private String buildFallbackErrorMessage(Message message) {
        String queue = message == null || message.getMessageProperties() == null
                ? "unknown"
                : String.valueOf(message.getMessageProperties().getConsumerQueue());
        return "task status event entered DLQ after retries exhausted: queue=" + queue;
    }
}
