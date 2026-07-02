// Responsibility: Implement task DLQ incident repository using JPA persistence.
package com.notebook.learyAI.module.task.infrastructure.repository;

import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import com.notebook.learyAI.module.task.domain.repository.TaskDlqIncidentRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.jpa.TaskDlqIncidentJpaRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskDlqIncidentPO;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public class TaskDlqIncidentRepositoryImpl implements TaskDlqIncidentRepository {
    private final TaskDlqIncidentJpaRepository jpaRepository;

    public TaskDlqIncidentRepositoryImpl(TaskDlqIncidentJpaRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public TaskDlqIncident save(TaskDlqIncident incident) {
        TaskDlqIncidentPO saved = jpaRepository.save(toPo(incident));
        return toDomain(saved);
    }

    @Override
    public Optional<TaskDlqIncident> findById(Long incidentId) {
        if (incidentId == null || incidentId <= 0L) {
            return Optional.empty();
        }
        return jpaRepository.findById(incidentId).map(this::toDomain);
    }

    @Override
    public Optional<TaskDlqIncident> findByMessageIdAndSourceQueue(String messageId, String sourceQueue) {
        if (messageId == null || messageId.isBlank() || sourceQueue == null || sourceQueue.isBlank()) {
            return Optional.empty();
        }
        return jpaRepository.findByMessageIdAndSourceQueue(messageId.trim(), sourceQueue.trim()).map(this::toDomain);
    }

    @Override
    public void deleteById(Long incidentId) {
        if (incidentId == null || incidentId <= 0L) {
            return;
        }
        jpaRepository.deleteById(incidentId);
    }

    private TaskDlqIncidentPO toPo(TaskDlqIncident incident) {
        TaskDlqIncidentPO po = new TaskDlqIncidentPO();
        po.setId(incident.getId());
        po.setMessageId(incident.getMessageId());
        po.setSourceQueue(incident.getSourceQueue());
        po.setSourceRoutingKey(incident.getSourceRoutingKey());
        po.setDlqType(incident.getDlqType());
        po.setTaskRecordId(incident.getTaskRecordId());
        po.setParentTaskRecordId(incident.getParentTaskRecordId());
        po.setProjectId(incident.getProjectId());
        po.setKbId(incident.getKbId());
        po.setStageRunKey(incident.getStageRunKey());
        po.setTaskType(incident.getTaskType());
        po.setPayloadJson(incident.getPayloadJson());
        po.setErrorMessage(incident.getErrorMessage());
        po.setRetryCount(incident.getRetryCount());
        po.setIncidentStatus(incident.getIncidentStatus());
        po.setCompensationAction(incident.getCompensationAction());
        Instant now = Instant.now();
        po.setCreatedAt(incident.getCreatedAt() == null ? now : incident.getCreatedAt());
        po.setUpdatedAt(incident.getUpdatedAt() == null ? now : incident.getUpdatedAt());
        return po;
    }

    private TaskDlqIncident toDomain(TaskDlqIncidentPO po) {
        return new TaskDlqIncident(
                po.getId(),
                po.getMessageId(),
                po.getSourceQueue(),
                po.getSourceRoutingKey(),
                po.getDlqType(),
                po.getTaskRecordId(),
                po.getParentTaskRecordId(),
                po.getProjectId(),
                po.getKbId(),
                po.getStageRunKey(),
                po.getTaskType(),
                po.getPayloadJson(),
                po.getErrorMessage(),
                po.getRetryCount(),
                po.getIncidentStatus(),
                po.getCompensationAction(),
                po.getCreatedAt(),
                po.getUpdatedAt()
        );
    }
}
