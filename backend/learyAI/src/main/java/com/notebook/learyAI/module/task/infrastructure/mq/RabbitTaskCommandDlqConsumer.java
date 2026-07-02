// Responsibility: Consume task.command.* DLQ messages, persist incidents, and emit FAILED status compensation events.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.service.TaskDlqIncidentAppService;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Map;

@Component
public class RabbitTaskCommandDlqConsumer {
    private static final Logger log = LoggerFactory.getLogger(RabbitTaskCommandDlqConsumer.class);
    private static final String CHANGE_TYPE = "dlq_command_compensate";
    private static final String ERROR_CODE = "TASK_COMMAND_DLQ";
    private static final String LAST_ERROR_CODE_HEADER = "x-last-error-code";
    private static final String LAST_ERROR_MESSAGE_HEADER = "x-last-error-message";
    private static final String COMPENSATION_ACTION_SUCCESS = "publish_failed_status_event";
    private static final String COMPENSATION_ACTION_FAILED = "publish_failed_status_event_failed";

    private final ObjectMapper objectMapper;
    private final TaskDlqIncidentAppService incidentAppService;
    private final TaskStatusEventPublisher taskStatusEventPublisher;

    public RabbitTaskCommandDlqConsumer(ObjectMapper objectMapper,
                                        TaskDlqIncidentAppService incidentAppService,
                                        TaskStatusEventPublisher taskStatusEventPublisher) {
        this.objectMapper = objectMapper;
        this.incidentAppService = incidentAppService;
        this.taskStatusEventPublisher = taskStatusEventPublisher;
    }

    @RabbitListener(queues = {
            "${task.mq.command.doc.dlq:task.doc.process.dlq}",
            "${task.mq.command.agent.dlq:task.agent.run.dlq}",
            "${task.mq.command.template-plugin.dlq:task.template-plugin.publish.dlq.queue}"
    })
    public void consume(Message message) {
        String body = new String(message.getBody(), StandardCharsets.UTF_8);
        String errorCode = resolveErrorCode(message);
        String errorMessage = resolveErrorMessage(message);
        TaskDlqIncident incident = null;
        try {
            TaskCommandEnvelope command = objectMapper.readValue(body, TaskCommandEnvelope.class);
            incident = incidentAppService.recordCommandIncident(command, message, errorMessage);
            if ("COMPENSATED".equals(incident.getIncidentStatus())) {
                return;
            }
            command.validateForDlqCompensation();
            taskStatusEventPublisher.publishFailedFromCommandDlq(command, errorCode, errorMessage, CHANGE_TYPE);
            incidentAppService.markCompensated(incident, COMPENSATION_ACTION_SUCCESS);
        } catch (Exception ex) {
            String incidentError = ex instanceof com.notebook.learyAI.shared.exception.BizException
                    ? errorMessage + "; validationError=" + ex.getMessage()
                    : errorMessage + "; parseError=" + ex.getMessage();
            if (incident != null) {
                incidentAppService.markCompensationFailed(incident, COMPENSATION_ACTION_FAILED, incidentError);
            } else {
                TaskDlqIncident rawIncident = incidentAppService.recordCommandIncident(null, message, incidentError);
                incidentAppService.markCompensationFailed(rawIncident, COMPENSATION_ACTION_FAILED, incidentError);
            }
            log.error("task.command DLQ compensation failed: queue={}, error={}, body={}",
                    message.getMessageProperties().getConsumerQueue(), ex.getMessage(), body, ex);
        }
    }

    private String resolveErrorCode(Message message) {
        String headerValue = headerText(message, LAST_ERROR_CODE_HEADER);
        return headerValue == null ? ERROR_CODE : headerValue;
    }

    private String resolveErrorMessage(Message message) {
        String headerValue = headerText(message, LAST_ERROR_MESSAGE_HEADER);
        if (headerValue != null) {
            return headerValue;
        }
        String queue = message == null || message.getMessageProperties() == null
                ? "unknown"
                : String.valueOf(message.getMessageProperties().getConsumerQueue());
        return "task command entered DLQ after retries exhausted: queue=" + queue;
    }

    private String headerText(Message message, String headerName) {
        if (message == null || message.getMessageProperties() == null) {
            return null;
        }
        Map<String, Object> headers = message.getMessageProperties().getHeaders();
        if (headers == null) {
            return null;
        }
        Object value = headers.get(headerName);
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }
}
