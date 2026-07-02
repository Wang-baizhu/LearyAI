// Responsibility: Persist task.status event idempotency records using JPA.
package com.notebook.learyAI.module.task.infrastructure.repository;

import com.notebook.learyAI.module.task.application.status.TaskStatusEventIdempotencyRepository;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.task.infrastructure.persistence.jpa.TaskStatusEventJpaRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskStatusEventPO;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.UUID;

@Repository
public class TaskStatusEventIdempotencyRepositoryImpl implements TaskStatusEventIdempotencyRepository {
    private final TaskStatusEventJpaRepository jpaRepository;

    public TaskStatusEventIdempotencyRepositoryImpl(TaskStatusEventJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public boolean markProcessed(String eventId, String projectId, Long taskRecordId, TaskStatus status, Instant processedAt) {
        TaskStatusEventPO po = new TaskStatusEventPO();
        po.setEventId(eventId);
        po.setProjectId(projectId == null || projectId.isBlank() ? null : UUID.fromString(projectId));
        po.setTaskRecordId(taskRecordId);
        po.setStatus(status.name());
        po.setProcessedAt(processedAt);
        try {
            jpaRepository.save(po);
            return true;
        } catch (DataIntegrityViolationException ex) {
            return false;
        }
    }

    @Override
    public void deleteProcessedBefore(Instant threshold) {
        if (threshold == null) {
            return;
        }
        jpaRepository.deleteByProcessedAtBefore(threshold);
    }
}
