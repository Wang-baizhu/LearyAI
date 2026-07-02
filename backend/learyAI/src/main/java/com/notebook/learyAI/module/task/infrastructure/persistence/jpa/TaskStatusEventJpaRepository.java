// Responsibility: Spring Data JPA repository for task.status idempotency records.
package com.notebook.learyAI.module.task.infrastructure.persistence.jpa;

import com.notebook.learyAI.module.task.infrastructure.persistence.po.TaskStatusEventPO;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;

public interface TaskStatusEventJpaRepository extends JpaRepository<TaskStatusEventPO, Long> {
    void deleteByProcessedAtBefore(Instant processedAt);
}
