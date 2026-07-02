// Responsibility: Domain repository for persisted task DLQ incidents.
package com.notebook.learyAI.module.task.domain.repository;

import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;

import java.util.Optional;

public interface TaskDlqIncidentRepository {
    TaskDlqIncident save(TaskDlqIncident incident);

    Optional<TaskDlqIncident> findById(Long incidentId);

    Optional<TaskDlqIncident> findByMessageIdAndSourceQueue(String messageId, String sourceQueue);

    void deleteById(Long incidentId);
}
