// Responsibility: Verify command DLQ consumer incident recording and failed-status compensation behavior.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.service.TaskDlqIncidentAppService;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.core.MessageProperties;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RabbitTaskCommandDlqConsumerTest {
    @Mock
    private ObjectMapper objectMapper;
    @Mock
    private TaskDlqIncidentAppService incidentAppService;
    @Mock
    private TaskStatusEventPublisher taskStatusEventPublisher;

    @Test
    @DisplayName("consume: 首次 command DLQ 应记录 incident 并补发 FAILED 状态事件")
    void consume_whenFirstSeen_shouldPublishFailedStatusEvent() throws Exception {
        RabbitTaskCommandDlqConsumer consumer = new RabbitTaskCommandDlqConsumer(
                objectMapper, incidentAppService, taskStatusEventPublisher
        );
        Message message = buildMessage("{\"messageId\":\"cmd-1\"}", "task.agent.run.dlq");
        TaskCommandEnvelope envelope = new TaskCommandEnvelope();
        envelope.setMessageId("cmd-1");
        envelope.setTaskRecordId(12L);
        envelope.setTaskType("agent");
        envelope.setProjectId("project-1");
        envelope.setKbId("kb-1");
        TaskDlqIncident incident = TaskDlqIncident.newOpenIncident(
                "cmd-1", "task.agent.run.dlq", "task.command.agent.run.dlq", "COMMAND",
                12L, 1L, "project-1", "kb-1", "agent:summary", "agent", "{}", "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskCommandEnvelope.class))).thenReturn(envelope);
        when(incidentAppService.recordCommandIncident(any(), any(), any())).thenReturn(incident);

        consumer.consume(message);

        verify(taskStatusEventPublisher).publishFailedFromCommandDlq(
                envelope, "TASK_EXEC_FAILED", "agent worker failed",
                "dlq_command_compensate"
        );
        verify(incidentAppService).markCompensated(incident, "publish_failed_status_event");
    }

    @Test
    @DisplayName("consume: 已补偿的 command DLQ incident 不应重复补发状态事件")
    void consume_whenAlreadyCompensated_shouldSkipPublish() throws Exception {
        RabbitTaskCommandDlqConsumer consumer = new RabbitTaskCommandDlqConsumer(
                objectMapper, incidentAppService, taskStatusEventPublisher
        );
        Message message = buildMessage("{\"messageId\":\"cmd-2\"}", "task.doc.process.dlq");
        TaskCommandEnvelope envelope = new TaskCommandEnvelope();
        envelope.setMessageId("cmd-2");
        envelope.setTaskRecordId(13L);
        envelope.setTaskType("doc");
        envelope.setProjectId("project-1");
        envelope.setKbId("kb-1");
        TaskDlqIncident incident = TaskDlqIncident.newOpenIncident(
                "cmd-2", "task.doc.process.dlq", "task.command.doc.process.dlq", "COMMAND",
                13L, 1L, "project-1", "kb-1", "doc:main", "doc", "{}", "err", 3, Instant.now()
        ).withCompensation("publish_failed_status_event", Instant.now());
        when(objectMapper.readValue(any(String.class), eq(TaskCommandEnvelope.class))).thenReturn(envelope);
        when(incidentAppService.recordCommandIncident(any(), any(), any())).thenReturn(incident);

        consumer.consume(message);

        verify(taskStatusEventPublisher, never()).publishFailedFromCommandDlq(any(), any(), any(), any());
        verify(incidentAppService, never()).markCompensated(any(), any());
    }

    @Test
    @DisplayName("consume: command DLQ 解析失败时应至少记录原始 incident")
    void consume_whenParseFailed_shouldRecordRawIncident() throws Exception {
        RabbitTaskCommandDlqConsumer consumer = new RabbitTaskCommandDlqConsumer(
                objectMapper, incidentAppService, taskStatusEventPublisher
        );
        Message message = buildMessage("{bad-json}", "task.agent.run.dlq");
        TaskDlqIncident rawIncident = TaskDlqIncident.newOpenIncident(
                "raw-1", "task.agent.run.dlq", "task.command.agent.run.dlq", "COMMAND",
                null, null, null, null, null, null, null, "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskCommandEnvelope.class)))
                .thenThrow(new IllegalArgumentException("bad command"));
        when(incidentAppService.recordCommandIncident(isNull(), any(), contains("parseError=bad command"))).thenReturn(rawIncident);

        consumer.consume(message);

        verify(incidentAppService).recordCommandIncident(isNull(), any(), contains("parseError=bad command"));
        verify(incidentAppService).markCompensationFailed(rawIncident, "publish_failed_status_event_failed",
                "agent worker failed; parseError=bad command");
        verify(taskStatusEventPublisher, never()).publishFailedFromCommandDlq(any(), any(), any(), any());
    }

    @Test
    @DisplayName("consume: command DLQ 缺少补偿关键字段时只记录 validation incident")
    void consume_whenEnvelopeInvalid_shouldRecordValidationIncidentOnly() throws Exception {
        RabbitTaskCommandDlqConsumer consumer = new RabbitTaskCommandDlqConsumer(
                objectMapper, incidentAppService, taskStatusEventPublisher
        );
        Message message = buildMessage("{\"messageId\":\"cmd-3\"}", "task.agent.run.dlq");
        TaskCommandEnvelope envelope = new TaskCommandEnvelope();
        envelope.setMessageId("cmd-3");
        envelope.setTaskType("agent");
        TaskDlqIncident incident = TaskDlqIncident.newOpenIncident(
                "cmd-3", "task.agent.run.dlq", "task.command.agent.run.dlq", "COMMAND",
                null, 1L, "project-1", "kb-1", "agent:summary", "agent", "{}", "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskCommandEnvelope.class))).thenReturn(envelope);
        when(incidentAppService.recordCommandIncident(any(), any(), any())).thenReturn(incident);

        consumer.consume(message);

        verify(incidentAppService).markCompensationFailed(incident, "publish_failed_status_event_failed",
                "agent worker failed; validationError=taskRecordId required");
        verify(taskStatusEventPublisher, never()).publishFailedFromCommandDlq(any(), any(), any(), any());
        verify(incidentAppService, never()).markCompensated(any(), any());
    }

    @Test
    @DisplayName("consume: command DLQ 补发 FAILED 事件失败时应保留 open incident 并写补偿失败动作")
    void consume_whenPublishFailed_shouldMarkCompensationFailed() throws Exception {
        RabbitTaskCommandDlqConsumer consumer = new RabbitTaskCommandDlqConsumer(
                objectMapper, incidentAppService, taskStatusEventPublisher
        );
        Message message = buildMessage("{\"messageId\":\"cmd-4\"}", "task.agent.run.dlq");
        TaskCommandEnvelope envelope = new TaskCommandEnvelope();
        envelope.setMessageId("cmd-4");
        envelope.setTaskRecordId(14L);
        envelope.setTaskType("agent");
        envelope.setProjectId("project-1");
        envelope.setKbId("kb-1");
        TaskDlqIncident incident = TaskDlqIncident.newOpenIncident(
                "cmd-4", "task.agent.run.dlq", "task.command.agent.run.dlq", "COMMAND",
                14L, 1L, "project-1", "kb-1", "agent:summary", "agent", "{}", "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskCommandEnvelope.class))).thenReturn(envelope);
        when(incidentAppService.recordCommandIncident(any(), any(), any())).thenReturn(incident);
        org.mockito.Mockito.doThrow(new IllegalStateException("mq down"))
                .when(taskStatusEventPublisher).publishFailedFromCommandDlq(any(), any(), any(), any());

        consumer.consume(message);

        verify(incidentAppService).markCompensationFailed(incident, "publish_failed_status_event_failed",
                "agent worker failed; parseError=mq down");
        verify(incidentAppService, never()).markCompensated(any(), any());
    }

    private Message buildMessage(String body, String queue) {
        MessageProperties properties = new MessageProperties();
        properties.setConsumerQueue(queue);
        properties.setReceivedRoutingKey(queue);
        properties.setHeader("x-retry-count", 3);
        properties.setHeader("x-last-error-code", "TASK_EXEC_FAILED");
        properties.setHeader("x-last-error-message", "agent worker failed");
        return new Message(body.getBytes(StandardCharsets.UTF_8), properties);
    }
}
