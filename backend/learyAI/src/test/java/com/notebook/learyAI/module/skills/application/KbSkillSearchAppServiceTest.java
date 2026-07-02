// Responsibility: Verify kb skill search task creation restores scope from persisted uuid tokens.
package com.notebook.learyAI.module.skills.application;

import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.skills.domain.repository.KbSkillTokenRepository;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbSkillSearchAppServiceTest {
    @Mock
    private KbSkillTokenRepository kbSkillTokenRepository;
    @Mock
    private TaskAppService taskAppService;
    @Mock
    private TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    @Mock
    private TaskStatusService taskStatusService;

    @Test
    @DisplayName("createSearchTask: 应按 uuid token 查 token 并把 scope 写入 task pipelineContext")
    void createSearchTask_shouldPersistScopeIntoTaskPipelineContext() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-05T08:30:00Z"), ZoneOffset.UTC);
        KbSkillTokenResolverAppService resolverAppService = new KbSkillTokenResolverAppService(kbSkillTokenRepository, clock);
        KbSkillSearchAppService appService = new KbSkillSearchAppService(
                resolverAppService, taskAppService, taskWorkflowOrchestrator, taskStatusService, clock
        );
        Instant now = Instant.now(clock);
        KbSkillTokenRecord tokenRecord = new KbSkillTokenRecord(
                15L,
                UUID.fromString("8a557f87-7f64-4e58-8414-17df6966f9b5"),
                1L,
                new KbSkillTokenPayload(
                        "kb.explorer",
                        List.of("search"),
                        "540c5364-27d6-445c-9b22-9ebd562f726c",
                        "e09a7341-259c-42cd-a9fc-faff87e2f065",
                        List.of(Map.of(
                                "id", "ef7d23c56b144b118217507e030a0516",
                                "name", "事故树分析 (FTA) 全面讲解"
                        ))
                ),
                now.plusSeconds(900),
                now
        );
        Task task = new Task(
                101L,
                "task-101",
                "540c5364-27d6-445c-9b22-9ebd562f726c",
                "e09a7341-259c-42cd-a9fc-faff87e2f065",
                1L,
                TaskTypes.SEARCH_PIPELINE,
                TaskStatus.PROCESSING,
                null,
                "{\"projectId\":\"540c5364-27d6-445c-9b22-9ebd562f726c\",\"kbId\":\"e09a7341-259c-42cd-a9fc-faff87e2f065\"}",
                null,
                "_",
                now,
                now
        );
        when(kbSkillTokenRepository.findByToken(UUID.fromString("8a557f87-7f64-4e58-8414-17df6966f9b5")))
                .thenReturn(java.util.Optional.of(tokenRecord));
        when(taskAppService.writeJson(any())).thenReturn("{json}");
        when(taskAppService.createVisibleTask(
                eq("540c5364-27d6-445c-9b22-9ebd562f726c"),
                eq("e09a7341-259c-42cd-a9fc-faff87e2f065"),
                eq(1L),
                eq(TaskTypes.SEARCH_PIPELINE),
                eq("_"),
                eq(TaskStatus.PROCESSING),
                eq("{json}"),
                any()
        )).thenReturn(task);

        Task response = appService.createSearchTask("8a557f87-7f64-4e58-8414-17df6966f9b5", " 总结事故树分析 ");

        assertEquals(101L, response.getTaskRecordId());
        ArgumentCaptor<Map<String, Object>> contextCaptor = ArgumentCaptor.forClass(Map.class);
        verify(taskAppService).writeJson(contextCaptor.capture());
        Map<String, Object> pipelineContext = contextCaptor.getValue();
        assertEquals("总结事故树分析", pipelineContext.get("query"));
        assertEquals(List.of(Map.of(
                "id", "ef7d23c56b144b118217507e030a0516",
                "name", "事故树分析 (FTA) 全面讲解"
        )), pipelineContext.get("docRefs"));
        verify(taskWorkflowOrchestrator).startPipeline(eq(task), eq(pipelineContext), eq(1L));
        verify(taskStatusService).publishSnapshot(task, "status_snapshot");
    }

    @Test
    @DisplayName("createSearchTask: 未命中 token 时应返回 KB_SKILL-403")
    void createSearchTask_whenTokenMissing_shouldThrowKbSkill403() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-05T08:30:00Z"), ZoneOffset.UTC);
        KbSkillTokenResolverAppService resolverAppService = new KbSkillTokenResolverAppService(kbSkillTokenRepository, clock);
        KbSkillSearchAppService appService = new KbSkillSearchAppService(
                resolverAppService, taskAppService, taskWorkflowOrchestrator, taskStatusService, clock
        );

        BizException ex = assertThrows(BizException.class, () -> appService.createSearchTask("missing-token", "query"));

        assertEquals("KB_SKILL-403", ex.getCode());
        verify(kbSkillTokenRepository, never()).findByToken(any());
    }

    @Test
    @DisplayName("createSearchTask: token 过期时应返回 KB_SKILL-403")
    void createSearchTask_whenTokenExpired_shouldThrowKbSkill403() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-05T08:30:00Z"), ZoneOffset.UTC);
        KbSkillTokenResolverAppService resolverAppService = new KbSkillTokenResolverAppService(kbSkillTokenRepository, clock);
        KbSkillSearchAppService appService = new KbSkillSearchAppService(
                resolverAppService, taskAppService, taskWorkflowOrchestrator, taskStatusService, clock
        );
        KbSkillTokenRecord tokenRecord = new KbSkillTokenRecord(
                15L,
                UUID.fromString("8a557f87-7f64-4e58-8414-17df6966f9b5"),
                1L,
                new KbSkillTokenPayload(
                        "kb.explorer",
                        List.of("search"),
                        "540c5364-27d6-445c-9b22-9ebd562f726c",
                        "e09a7341-259c-42cd-a9fc-faff87e2f065",
                        List.of(Map.of(
                                "id", "ef7d23c56b144b118217507e030a0516",
                                "name", "事故树分析 (FTA) 全面讲解"
                        ))
                ),
                Instant.parse("2026-05-05T08:29:59Z"),
                Instant.parse("2026-05-05T08:00:00Z")
        );
        when(kbSkillTokenRepository.findByToken(UUID.fromString("8a557f87-7f64-4e58-8414-17df6966f9b5")))
                .thenReturn(java.util.Optional.of(tokenRecord));

        BizException ex = assertThrows(BizException.class, () -> appService.createSearchTask(
                "8a557f87-7f64-4e58-8414-17df6966f9b5",
                "query"
        ));

        assertEquals("KB_SKILL-403", ex.getCode());
        verify(taskAppService, never()).writeJson(any());
    }
}
