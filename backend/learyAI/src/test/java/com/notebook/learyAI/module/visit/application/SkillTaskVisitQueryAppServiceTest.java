// Responsibility: Verify skill-task query only reads visible search-pipeline tasks by persisted token scope.
package com.notebook.learyAI.module.visit.application;

import com.notebook.learyAI.module.skills.application.KbSkillTokenResolverAppService;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.skills.domain.repository.KbSkillTokenRepository;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SkillTaskVisitQueryAppServiceTest {
    private static final String TASK_ID = "6dd0b45f-77b1-4fca-8f1f-f4a3d4b8e8aa";

    @Mock
    private KbSkillTokenRepository kbSkillTokenRepository;
    @Mock
    private TaskAppService taskAppService;

    @Test
    @DisplayName("getTaskDetail: 应按 token 恢复 userId/projectId/kbId 查询 search_pipeline 任务")
    void getTaskDetail_shouldQueryTaskByTokenScope() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-05T08:30:00Z"), ZoneOffset.UTC);
        KbSkillTokenResolverAppService resolverAppService = new KbSkillTokenResolverAppService(kbSkillTokenRepository, clock);
        SkillTaskVisitQueryAppService appService = new SkillTaskVisitQueryAppService(resolverAppService, taskAppService);
        KbSkillTokenRecord tokenRecord = new KbSkillTokenRecord(
                1L,
                UUID.fromString("8a557f87-7f64-4e58-8414-17df6966f9b5"),
                7L,
                new KbSkillTokenPayload(
                        "kb.explorer",
                        List.of("search"),
                        "540c5364-27d6-445c-9b22-9ebd562f726c",
                        "e09a7341-259c-42cd-a9fc-faff87e2f065",
                        List.of(Map.of("id", "doc-1", "name", "doc"))
                ),
                Instant.parse("2026-05-05T08:45:00Z"),
                Instant.parse("2026-05-05T08:00:00Z")
        );
        Task task = new Task(123L, TASK_ID, "540c5364-27d6-445c-9b22-9ebd562f726c",
                "e09a7341-259c-42cd-a9fc-faff87e2f065", 7L, TaskTypes.SEARCH_PIPELINE, TaskStatus.PROCESSING,
                null, "{\"projectId\":\"540c5364-27d6-445c-9b22-9ebd562f726c\"}", null,
                "_", Instant.now(clock), Instant.now(clock));
        when(kbSkillTokenRepository.findByToken(UUID.fromString("8a557f87-7f64-4e58-8414-17df6966f9b5")))
                .thenReturn(Optional.of(tokenRecord));
        when(taskAppService.findVisibleSearchPipelineByPublicTaskIdAndScope(TASK_ID, 7L,
                "540c5364-27d6-445c-9b22-9ebd562f726c", "e09a7341-259c-42cd-a9fc-faff87e2f065"))
                .thenReturn(Optional.of(task));

        Task result = appService.getTaskDetail(TASK_ID, "8a557f87-7f64-4e58-8414-17df6966f9b5");

        assertEquals(123L, result.getTaskRecordId());
        assertEquals(TASK_ID, result.getPublicTaskId());
        verify(taskAppService).findVisibleSearchPipelineByPublicTaskIdAndScope(TASK_ID, 7L,
                "540c5364-27d6-445c-9b22-9ebd562f726c", "e09a7341-259c-42cd-a9fc-faff87e2f065");
    }

    @Test
    @DisplayName("getTaskDetail: taskId 非法应返回 KB-400")
    void getTaskDetail_whenTaskIdInvalid_shouldThrowKb400() {
        SkillTaskVisitQueryAppService appService = new SkillTaskVisitQueryAppService(
                new KbSkillTokenResolverAppService(kbSkillTokenRepository), taskAppService
        );

        BizException ex = assertThrows(BizException.class, () -> appService.getTaskDetail(" ", "token"));

        assertEquals("KB-400", ex.getCode());
    }
}
