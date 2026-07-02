// Responsibility: Spring Data repository for task_dlq_incident table.
package com.notebook.learyAI.module.task.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskDlqIncidentPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TaskDlqIncidentJpaRepository extends JpaRepository<TaskDlqIncidentPO, Long> {
    Optional<TaskDlqIncidentPO> findByMessageIdAndSourceQueue(String messageId, String sourceQueue);
}
