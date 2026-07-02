// Responsibility: Verify task query input normalization and permission-protected type filtering.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.authz.domain.model.ProjectRole;
import com.notebook.learyAI.module.authz.interfaces.facade.AuthzSdk;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskQueryAppService;
import com.notebook.learyAI.module.task.domain.model.TaskPage;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TaskQueryAppServiceTest {
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private AuthzSdk authzSdk;

    private TaskQueryAppService service;

    @BeforeEach
    void setUp() {
        service = new TaskQueryAppService(taskAppService, authzSdk);
    }

    @Test
    @DisplayName("listTasks: pptprompt_pipeline 应允许查询")
    void listTasks_whenTypePptPromptPipeline_shouldAllow() {
        TaskPage page = new TaskPage(List.of(), 0, 1, 0);
        when(authzSdk.requireUserId()).thenReturn(9L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");
        when(taskAppService.findByProjectAndKbIdAndTypesAndStatuses(
                "p1",
                "kb-1",
                List.of(TaskTypes.PPTPROMPT_PIPELINE),
                List.of(TaskStatus.PROCESSING),
                1,
                20
        )).thenReturn(page);

        TaskPage result = service.listTasks(
                "p1",
                "kb-1",
                List.of(TaskTypes.PPTPROMPT_PIPELINE),
                List.of("processing"),
                null,
                null
        );

        assertEquals(page, result);
        verify(authzSdk).requireRole(9L, "p1", Set.of(
                ProjectRole.OWNER, ProjectRole.ADMIN, ProjectRole.MEMBER
        ));
    }

    @Test
    @DisplayName("listTasks: 未知 type 应返回 KB-400")
    void listTasks_whenTypeInvalid_shouldThrowKb400() {
        when(authzSdk.requireUserId()).thenReturn(9L);
        when(authzSdk.requireProjectId("p1", "KB-400", "KB-400", "KB-404")).thenReturn("p1");

        BizException ex = assertThrows(BizException.class, () -> service.listTasks(
                "p1",
                "kb-1",
                List.of("unknown_pipeline"),
                List.of("processing"),
                null,
                null
        ));

        assertEquals("KB-400", ex.getCode());
    }
}
