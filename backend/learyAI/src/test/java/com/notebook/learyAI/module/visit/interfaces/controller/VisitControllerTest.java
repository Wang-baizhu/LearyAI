// Responsibility: Verify VisitController HTTP contract and error mapping for recent-visit query.
package com.notebook.learyAI.module.visit.interfaces.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.notebook.learyAI.module.skills.application.KbSkillSearchResponseAssembler;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.module.visit.application.SkillTaskVisitQueryAppService;
import com.notebook.learyAI.module.visit.application.VisitQueryAppService;
import com.notebook.learyAI.shared.exception.BizException;
import com.notebook.learyAI.shared.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class VisitControllerTest {
    private static final String TASK_ID_DONE = "6dd0b45f-77b1-4fca-8f1f-f4a3d4b8e8aa";
    private static final String TASK_ID_PENDING = "7fd4fae1-2c3c-4cf6-b2ee-fab6d7bc9d67";

    @Mock
    private VisitQueryAppService visitQueryAppService;
    @Mock
    private SkillTaskVisitQueryAppService skillTaskVisitQueryAppService;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        VisitController controller = new VisitController(visitQueryAppService, skillTaskVisitQueryAppService,
                new KbSkillSearchResponseAssembler(new ObjectMapper()));
        mockMvc = MockMvcBuilders.standaloneSetup(controller)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    @Test
    @DisplayName("GET /api/visits/recent: 成功返回分页列表契约")
    void recent_success_shouldReturnPagedResponse() throws Exception {
        Instant visitedAt = Instant.parse("2026-03-30T10:20:00Z");
        when(visitQueryAppService.listRecent(20, "next-0")).thenReturn(new VisitQueryAppService.RecentVisitPageView(
                List.of(new VisitQueryAppService.RecentVisitItemView(
                        "PROJECT", "project-1", visitedAt, true, "项目A", "项目简介", "project-1", null
                )),
                true,
                "next-1"
        ));

        mockMvc.perform(get("/api/visits/recent").param("size", "20").param("cursor", "next-0"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.hasMore").value(true))
                .andExpect(jsonPath("$.data.nextCursor").value("next-1"))
                .andExpect(jsonPath("$.data.items[0].resourceType").value("PROJECT"))
                .andExpect(jsonPath("$.data.items[0].resourceId").value("project-1"))
                .andExpect(jsonPath("$.data.items[0].available").value(true))
                .andExpect(jsonPath("$.data.items[0].title").value("项目A"))
                .andExpect(jsonPath("$.data.items[0].projectId").value("project-1"));

        verify(visitQueryAppService).listRecent(20, "next-0");
    }

    @Test
    @DisplayName("GET /api/visits/recent: 业务校验失败返回 BAD_REQUEST")
    void recent_whenBizException_shouldReturnBadRequest() throws Exception {
        when(visitQueryAppService.listRecent(0, null))
                .thenThrow(new BizException("VISIT-400", "size invalid"));

        mockMvc.perform(get("/api/visits/recent").param("size", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VISIT-400"))
                .andExpect(jsonPath("$.message").value("size invalid"));
    }

    @Test
    @DisplayName("GET /api/skills/tasks: 应返回 skill token 作用域内任务详情")
    void skillTaskDetail_shouldReturnTaskDetail() throws Exception {
        Instant now = Instant.parse("2026-05-05T08:15:00Z");
        when(skillTaskVisitQueryAppService.getTaskDetail(TASK_ID_DONE, "8a557f87-7f64-4e58-8414-17df6966f9b5"))
                .thenReturn(new Task(
                        123L,
                        TASK_ID_DONE,
                        "540c5364-27d6-445c-9b22-9ebd562f726c",
                        "e09a7341-259c-42cd-a9fc-faff87e2f065",
                        9L,
                        TaskTypes.SEARCH_PIPELINE,
                        TaskStatus.DONE,
                        "agent:search",
                        "{\"projectId\":\"540c5364-27d6-445c-9b22-9ebd562f726c\"}",
                        "{\"summary\":\"ok\"}",
                        "_",
                        now,
                        now
                ));

        mockMvc.perform(get("/api/skills/tasks")
                        .param("taskId", TASK_ID_DONE)
                        .param("token", "8a557f87-7f64-4e58-8414-17df6966f9b5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.taskId").value(TASK_ID_DONE))
                .andExpect(jsonPath("$.data.completed").value(true))
                .andExpect(jsonPath("$.data.answer").value("ok"));

        verify(skillTaskVisitQueryAppService).getTaskDetail(TASK_ID_DONE, "8a557f87-7f64-4e58-8414-17df6966f9b5");
    }

    @Test
    @DisplayName("GET /api/skills/tasks: 任务失败时应返回 errorMessage 且不返回 answer")
    void skillTaskDetail_whenTaskFailed_shouldReturnFailedReason() throws Exception {
        Instant now = Instant.parse("2026-05-05T08:15:00Z");
        when(skillTaskVisitQueryAppService.getTaskDetail(TASK_ID_DONE, "8a557f87-7f64-4e58-8414-17df6966f9b5"))
                .thenReturn(new Task(
                        125L,
                        TASK_ID_DONE,
                        "540c5364-27d6-445c-9b22-9ebd562f726c",
                        "e09a7341-259c-42cd-a9fc-faff87e2f065",
                        9L,
                        TaskTypes.SEARCH_PIPELINE,
                        TaskStatus.FAILED,
                        "agent:search",
                        "{\"projectId\":\"540c5364-27d6-445c-9b22-9ebd562f726c\"}",
                        "{\"summary\":\"stale\",\"failedReason\":\"检索失败\"}",
                        "_",
                        now,
                        now
                ));

        mockMvc.perform(get("/api/skills/tasks")
                        .param("taskId", TASK_ID_DONE)
                        .param("token", "8a557f87-7f64-4e58-8414-17df6966f9b5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.taskId").value(TASK_ID_DONE))
                .andExpect(jsonPath("$.data.completed").value(true))
                .andExpect(jsonPath("$.data.errorMessage").value("检索失败"))
                .andExpect(jsonPath("$.data.answer").doesNotExist());

        verify(skillTaskVisitQueryAppService).getTaskDetail(TASK_ID_DONE, "8a557f87-7f64-4e58-8414-17df6966f9b5");
    }

    @Test
    @DisplayName("GET /api/skills/tasks: 任务未完成时只返回 taskId 与 completed=false")
    void skillTaskDetail_whenTaskProcessing_shouldReturnPendingResponse() throws Exception {
        Instant now = Instant.parse("2026-05-05T08:15:00Z");
        when(skillTaskVisitQueryAppService.getTaskDetail(TASK_ID_PENDING, "8a557f87-7f64-4e58-8414-17df6966f9b5"))
                .thenReturn(new Task(
                        124L,
                        TASK_ID_PENDING,
                        "540c5364-27d6-445c-9b22-9ebd562f726c",
                        "e09a7341-259c-42cd-a9fc-faff87e2f065",
                        9L,
                        TaskTypes.SEARCH_PIPELINE,
                        TaskStatus.PROCESSING,
                        "agent:search",
                        "{\"projectId\":\"540c5364-27d6-445c-9b22-9ebd562f726c\"}",
                        "{\"summary\":\"ok\"}",
                        "_",
                        now,
                        now
                ));

        mockMvc.perform(get("/api/skills/tasks")
                        .param("taskId", TASK_ID_PENDING)
                        .param("token", "8a557f87-7f64-4e58-8414-17df6966f9b5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value("OK"))
                .andExpect(jsonPath("$.data.taskId").value(TASK_ID_PENDING))
                .andExpect(jsonPath("$.data.completed").value(false))
                .andExpect(jsonPath("$.data.answer").doesNotExist())
                .andExpect(jsonPath("$.data.errorMessage").doesNotExist());

        verify(skillTaskVisitQueryAppService).getTaskDetail(TASK_ID_PENDING, "8a557f87-7f64-4e58-8414-17df6966f9b5");
    }
}
