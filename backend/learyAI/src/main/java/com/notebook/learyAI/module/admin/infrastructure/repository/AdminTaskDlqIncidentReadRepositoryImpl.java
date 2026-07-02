// Responsibility: Implement admin read-only pagination queries for task DLQ incidents.
package com.notebook.learyAI.module.admin.infrastructure.repository;

import com.notebook.learyAI.module.admin.domain.repository.AdminTaskDlqIncidentReadRepository;
import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskDlqIncidentPO;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public class AdminTaskDlqIncidentReadRepositoryImpl implements AdminTaskDlqIncidentReadRepository {
    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public TaskDlqIncidentPageResult findIncidents(String incidentStatus, String dlqType, int page, int size) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.max(1, Math.min(size, 100));
        long offset = (long) safePage * safeSize;

        Long total = entityManager.createQuery("""
                        select count(i.id)
                        from TaskDlqIncidentPO i
                        where i.incidentStatus = coalesce(:incidentStatus, i.incidentStatus)
                          and i.dlqType = coalesce(:dlqType, i.dlqType)
                        """, Long.class)
                .setParameter("incidentStatus", incidentStatus)
                .setParameter("dlqType", dlqType)
                .getSingleResult();

        List<TaskDlqIncidentRow> items = entityManager.createQuery("""
                        select i
                        from TaskDlqIncidentPO i
                        where i.incidentStatus = coalesce(:incidentStatus, i.incidentStatus)
                          and i.dlqType = coalesce(:dlqType, i.dlqType)
                        order by i.createdAt desc, i.id desc
                        """, TaskDlqIncidentPO.class)
                .setParameter("incidentStatus", incidentStatus)
                .setParameter("dlqType", dlqType)
                .setFirstResult((int) Math.min(offset, Integer.MAX_VALUE))
                .setMaxResults(safeSize)
                .getResultList()
                .stream()
                .map(this::toRow)
                .toList();

        return new TaskDlqIncidentPageResult(total == null ? 0L : total, items);
    }

    private TaskDlqIncidentRow toRow(TaskDlqIncidentPO po) {
        return new TaskDlqIncidentRow(
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
