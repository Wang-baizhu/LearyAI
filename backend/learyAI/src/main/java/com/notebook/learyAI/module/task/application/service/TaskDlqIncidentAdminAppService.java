// Responsibility: Handle admin write operations for persisted task DLQ incidents.
package com.notebook.learyAI.module.task.application.service;

import com.notebook.learyAI.module.auth.application.PlatformAdminGuard;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import com.notebook.learyAI.module.task.domain.repository.TaskDlqIncidentRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;

@Service
public class TaskDlqIncidentAdminAppService {
    private static final Set<String> ALLOWED_MANUAL_STATUS = Set.of(
            TaskDlqIncident.STATUS_OPEN,
            TaskDlqIncident.STATUS_RESOLVED,
            TaskDlqIncident.STATUS_IGNORED
    );

    private final PlatformAdminGuard platformAdminGuard;
    private final TaskDlqIncidentRepository repository;

    public TaskDlqIncidentAdminAppService(PlatformAdminGuard platformAdminGuard,
                                          TaskDlqIncidentRepository repository) {
        this.platformAdminGuard = platformAdminGuard;
        this.repository = repository;
    }

    @Transactional
    public TaskDlqIncident updateStatus(Long incidentId, String incidentStatus) {
        platformAdminGuard.requireAdmin();
        long normalizedIncidentId = normalizeIncidentId(incidentId);
        String normalizedStatus = normalizeStatus(incidentStatus);
        TaskDlqIncident incident = repository.findById(normalizedIncidentId)
                .orElseThrow(() -> new BizException("TASK_DLQ_INCIDENT_NOT_FOUND", "task dlq incident not found"));
        return repository.save(incident.withStatus(normalizedStatus, Instant.now()));
    }

    @Transactional
    public void delete(Long incidentId) {
        platformAdminGuard.requireAdmin();
        long normalizedIncidentId = normalizeIncidentId(incidentId);
        if (repository.findById(normalizedIncidentId).isEmpty()) {
            throw new BizException("TASK_DLQ_INCIDENT_NOT_FOUND", "task dlq incident not found");
        }
        repository.deleteById(normalizedIncidentId);
    }

    private long normalizeIncidentId(Long incidentId) {
        if (incidentId == null || incidentId <= 0L) {
            throw new BizException("VALIDATION_ERROR", "incidentId invalid");
        }
        return incidentId;
    }

    private String normalizeStatus(String incidentStatus) {
        if (incidentStatus == null || incidentStatus.isBlank()) {
            throw new BizException("VALIDATION_ERROR", "incidentStatus invalid");
        }
        String normalizedStatus = incidentStatus.trim().toUpperCase();
        if (!ALLOWED_MANUAL_STATUS.contains(normalizedStatus)) {
            throw new BizException("VALIDATION_ERROR", "incidentStatus invalid");
        }
        return normalizedStatus;
    }
}
