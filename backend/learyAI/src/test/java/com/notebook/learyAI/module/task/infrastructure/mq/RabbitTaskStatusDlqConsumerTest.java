// Responsibility: Verify status DLQ consumer incident recording and final failed compensation behavior.
package com.notebook.learyAI.module.task.infrastructure.mq;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.task.application.service.TaskDlqIncidentAppService;
import com.notebook.learyAI.module.task.application.status.TaskStatusDlqCompensationAppService;
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
class RabbitTaskStatusDlqConsumerTest {
    @Mock
    private ObjectMapper objectMapper;
    @Mock
    private TaskDlqIncidentAppService incidentAppService;
    @Mock
    private TaskStatusDlqCompensationAppService compensationAppService;

    @Test
    @DisplayName("consume: 首次 status DLQ 应记录 incident 并执行最终失败补偿")
    void consume_whenFirstSeen_shouldCompensate() throws Exception {
        RabbitTaskStatusDlqConsumer consumer = new RabbitTaskStatusDlqConsumer(
                objectMapper, incidentAppService, compensationAppService
        );
        Message message = buildMessage("{\"messageId\":\"evt-1\"}");
        TaskStatusEvent event = new TaskStatusEvent();
        event.setMessageId("evt-1");
        event.setTaskRecordId(21L);
        event.setErrorMessage("status consumer failed");
        TaskDlqIncident incident = TaskDlqIncident.newOpenIncident(
                "evt-1", "task.status.changed.dlq", "task.event.status.changed.dlq", "STATUS",
                21L, 1L, "project-1", "kb-1", "agent:summary", "agent", "{}", "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class))).thenReturn(event);
        when(incidentAppService.recordStatusIncident(any(), any(), any())).thenReturn(incident);
        when(compensationAppService.compensate(any(), any())).thenReturn(true);

        consumer.consume(message);

        verify(compensationAppService).compensate(
                event, "status consumer failed"
        );
        verify(incidentAppService).markCompensated(incident, "force_stage_failed");
    }

    @Test
    @DisplayName("consume: status DLQ 补偿未落库时不应提前标记 incident 已补偿")
    void consume_whenCompensationSkipped_shouldKeepOpen() throws Exception {
        RabbitTaskStatusDlqConsumer consumer = new RabbitTaskStatusDlqConsumer(
                objectMapper, incidentAppService, compensationAppService
        );
        Message message = buildMessage("{\"messageId\":\"evt-2\"}");
        TaskStatusEvent event = new TaskStatusEvent();
        event.setMessageId("evt-2");
        TaskDlqIncident incident = TaskDlqIncident.newOpenIncident(
                "evt-2", "task.status.changed.dlq", "task.event.status.changed.dlq", "STATUS",
                22L, 1L, "project-1", "kb-1", "agent:summary", "agent", "{}", "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class))).thenReturn(event);
        when(incidentAppService.recordStatusIncident(any(), any(), any())).thenReturn(incident);
        when(compensationAppService.compensate(any(), any())).thenReturn(false);

        consumer.consume(message);

        verify(incidentAppService, never()).markCompensated(any(), any());
    }

    @Test
    @DisplayName("consume: status DLQ 解析失败时应至少记录原始 incident")
    void consume_whenParseFailed_shouldRecordRawIncident() throws Exception {
        RabbitTaskStatusDlqConsumer consumer = new RabbitTaskStatusDlqConsumer(
                objectMapper, incidentAppService, compensationAppService
        );
        Message message = buildMessage("{bad-json}");
        TaskDlqIncident rawIncident = TaskDlqIncident.newOpenIncident(
                "raw-evt-1", "task.status.changed.dlq", "task.event.status.changed.dlq", "STATUS",
                null, null, null, null, null, null, null, "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class)))
                .thenThrow(new IllegalArgumentException("bad event"));
        when(incidentAppService.recordStatusIncident(isNull(), any(), contains("parseError=bad event"))).thenReturn(rawIncident);

        consumer.consume(message);

        verify(incidentAppService).recordStatusIncident(isNull(), any(), contains("parseError=bad event"));
        verify(incidentAppService).markCompensationFailed(rawIncident, "force_stage_failed_failed",
                "task status event entered DLQ after retries exhausted: queue=task.status.changed.dlq; parseError=bad event");
        verify(compensationAppService, never()).compensate(any(), any());
    }

    @Test
    @DisplayName("consume: status DLQ 最终补偿抛错时应保留 open incident 并写补偿失败动作")
    void consume_whenCompensationThrows_shouldMarkCompensationFailed() throws Exception {
        RabbitTaskStatusDlqConsumer consumer = new RabbitTaskStatusDlqConsumer(
                objectMapper, incidentAppService, compensationAppService
        );
        Message message = buildMessage("{\"messageId\":\"evt-3\"}");
        TaskStatusEvent event = new TaskStatusEvent();
        event.setMessageId("evt-3");
        event.setTaskRecordId(23L);
        event.setErrorMessage("status consumer failed");
        TaskDlqIncident incident = TaskDlqIncident.newOpenIncident(
                "evt-3", "task.status.changed.dlq", "task.event.status.changed.dlq", "STATUS",
                23L, 1L, "project-1", "kb-1", "agent:summary", "agent", "{}", "err", 3, Instant.now()
        );
        when(objectMapper.readValue(any(String.class), eq(TaskStatusEvent.class))).thenReturn(event);
        when(incidentAppService.recordStatusIncident(any(), any(), any())).thenReturn(incident);
        when(compensationAppService.compensate(any(), any())).thenThrow(new IllegalStateException("db down"));

        consumer.consume(message);

        verify(incidentAppService).markCompensationFailed(incident, "force_stage_failed_failed",
                "status consumer failed; parseError=db down");
        verify(incidentAppService, never()).markCompensated(any(), any());
    }

    private Message buildMessage(String body) {
        MessageProperties properties = new MessageProperties();
        properties.setConsumerQueue("task.status.changed.dlq");
        properties.setReceivedRoutingKey("task.event.status.changed.dlq");
        properties.setHeader("x-retry-count", 3);
        return new Message(body.getBytes(StandardCharsets.UTF_8), properties);
    }
}
