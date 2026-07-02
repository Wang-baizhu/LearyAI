// Responsibility: Verify admin DLQ incident status updates and deletion behavior.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.auth.application.PlatformAdminGuard;
import com.notebook.learyAI.module.task.application.service.TaskDlqIncidentAdminAppService;
import com.notebook.learyAI.module.task.domain.model.TaskDlqIncident;
import com.notebook.learyAI.module.task.domain.repository.TaskDlqIncidentRepository;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskDlqIncidentAdminAppServiceTest {
    @Mock
    private PlatformAdminGuard platformAdminGuard;

    @Mock
    private TaskDlqIncidentRepository repository;

    @Test
    @DisplayName("updateStatus: 应更新为人工处理状态并持久化")
    void updateStatus_shouldPersistManualStatus() {
        TaskDlqIncidentAdminAppService appService = new TaskDlqIncidentAdminAppService(platformAdminGuard, repository);
        TaskDlqIncident incident = incident(1L, TaskDlqIncident.STATUS_OPEN);
        TaskDlqIncident resolved = incident.withStatus(TaskDlqIncident.STATUS_RESOLVED, Instant.now());
        when(repository.findById(1L)).thenReturn(Optional.of(incident));
        when(repository.save(org.mockito.ArgumentMatchers.any(TaskDlqIncident.class))).thenReturn(resolved);

        TaskDlqIncident result = appService.updateStatus(1L, "resolved");

        assertEquals(TaskDlqIncident.STATUS_RESOLVED, result.getIncidentStatus());
        verify(repository).save(org.mockito.ArgumentMatchers.any(TaskDlqIncident.class));
    }

    @Test
    @DisplayName("updateStatus: 非法人工状态应拒绝")
    void updateStatus_whenInvalidStatus_shouldFail() {
        TaskDlqIncidentAdminAppService appService = new TaskDlqIncidentAdminAppService(platformAdminGuard, repository);

        BizException error = assertThrows(BizException.class, () -> appService.updateStatus(1L, "COMPENSATED"));

        assertEquals("VALIDATION_ERROR", error.getCode());
    }

    @Test
    @DisplayName("updateStatus: 非管理员应拒绝")
    void updateStatus_whenNotAdmin_shouldFail() {
        TaskDlqIncidentAdminAppService appService = new TaskDlqIncidentAdminAppService(platformAdminGuard, repository);
        org.mockito.Mockito.doThrow(new BizException("ADMIN_FORBIDDEN", "platform admin required"))
                .when(platformAdminGuard).requireAdmin();

        BizException error = assertThrows(BizException.class, () -> appService.updateStatus(1L, "RESOLVED"));

        assertEquals("ADMIN_FORBIDDEN", error.getCode());
    }

    @Test
    @DisplayName("delete: 记录存在时应删除")
    void delete_shouldRemoveIncident() {
        TaskDlqIncidentAdminAppService appService = new TaskDlqIncidentAdminAppService(platformAdminGuard, repository);
        when(repository.findById(2L)).thenReturn(Optional.of(incident(2L, TaskDlqIncident.STATUS_OPEN)));

        appService.delete(2L);

        verify(repository).deleteById(2L);
    }

    private TaskDlqIncident incident(Long id, String status) {
        Instant now = Instant.now();
        return new TaskDlqIncident(
                id,
                "msg-" + id,
                "task.agent.run.dlq",
                "task.command.agent.run.dlq",
                "COMMAND",
                11L,
                10L,
                "project-1",
                "kb-1",
                "stage-1",
                "agent",
                "{}",
                "boom",
                3,
                status,
                null,
                now,
                now
        );
    }
}
