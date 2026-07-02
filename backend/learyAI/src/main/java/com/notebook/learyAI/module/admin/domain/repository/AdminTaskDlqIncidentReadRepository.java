// Responsibility: Define admin read-only pagination queries for task DLQ incidents.
package com.notebook.learyAI.module.admin.domain.repository;

import java.time.Instant;
import java.util.List;

public interface AdminTaskDlqIncidentReadRepository {
    TaskDlqIncidentPageResult findIncidents(String incidentStatus,
                                            String dlqType,
                                            int page,
                                            int size);

    record TaskDlqIncidentRow(Long incidentId,
                              String messageId,
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
                              Integer retryCount,
                              String incidentStatus,
                              String compensationAction,
                              Instant createdAt,
                              Instant updatedAt) {
    }

    record TaskDlqIncidentPageResult(long total, List<TaskDlqIncidentRow> items) {
    }
}
