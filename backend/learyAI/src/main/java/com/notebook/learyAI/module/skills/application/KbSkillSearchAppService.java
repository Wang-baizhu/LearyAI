// Responsibility: Verify kb skill search tokens, expand doc scope, and create search pipeline tasks.
package com.notebook.learyAI.module.skills.application;

import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenPayload;
import com.notebook.learyAI.module.skills.domain.model.KbSkillTokenRecord;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.orchestration.TaskWorkflowOrchestrator;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import com.notebook.learyAI.shared.exception.BizException;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class KbSkillSearchAppService {
    private final KbSkillTokenResolverAppService kbSkillTokenResolverAppService;
    private final TaskAppService taskAppService;
    private final TaskWorkflowOrchestrator taskWorkflowOrchestrator;
    private final TaskStatusService taskStatusService;
    private final Clock clock;

    public KbSkillSearchAppService(KbSkillTokenResolverAppService kbSkillTokenResolverAppService,
                                   TaskAppService taskAppService,
                                   TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                   TaskStatusService taskStatusService) {
        this(kbSkillTokenResolverAppService, taskAppService, taskWorkflowOrchestrator, taskStatusService, Clock.systemUTC());
    }

    @Autowired
    public KbSkillSearchAppService(KbSkillTokenResolverAppService kbSkillTokenResolverAppService,
                                   TaskAppService taskAppService,
                                   TaskWorkflowOrchestrator taskWorkflowOrchestrator,
                                   TaskStatusService taskStatusService,
                                   Clock clock) {
        this.kbSkillTokenResolverAppService = kbSkillTokenResolverAppService;
        this.taskAppService = taskAppService;
        this.taskWorkflowOrchestrator = taskWorkflowOrchestrator;
        this.taskStatusService = taskStatusService;
        this.clock = clock;
    }

    @Transactional
    public Task createSearchTask(String token, String query) {
        KbSkillTokenRecord tokenRecord = kbSkillTokenResolverAppService.resolveActiveToken(token);
        KbSkillTokenPayload payload = tokenRecord.getPayload();
        if (!payload.getAbilities().contains("search")) {
            throw new BizException("KB_SKILL-403", "kb skill ability denied");
        }
        String normalizedQuery = normalizeRequired(query, "query");
        String projectId = normalizeRequired(payload.getProjectId(), "projectId");
        String kbId = normalizeRequired(payload.getKbId(), "kbId");
        List<Map<String, Object>> docRefs = resolveDocRefs(payload);
        if (docRefs.isEmpty()) {
            throw new BizException("KB_SKILL-404", "no documents available for this token scope");
        }
        Map<String, Object> pipelineContext = new HashMap<>();
        pipelineContext.put("query", normalizedQuery);
        pipelineContext.put("docRefs", docRefs);
        String pipelineContextJson = taskAppService.writeJson(pipelineContext);
        Task task = taskAppService.createVisibleTask(
                projectId,
                kbId,
                tokenRecord.getUserId(),
                TaskTypes.SEARCH_PIPELINE,
                "_",
                TaskStatus.PROCESSING,
                pipelineContextJson,
                Instant.now(clock)
        );
        taskWorkflowOrchestrator.startPipeline(task, pipelineContext, tokenRecord.getUserId());
        taskStatusService.publishSnapshot(task, "status_snapshot");
        return task;
    }

    private List<Map<String, Object>> resolveDocRefs(KbSkillTokenPayload payload) {
        if (payload.getDocRefs() == null || payload.getDocRefs().isEmpty()) {
            return List.of();
        }
        List<Map<String, Object>> docRefs = new java.util.ArrayList<>();
        for (Map<String, Object> rawDocRef : payload.getDocRefs()) {
            if (rawDocRef == null) {
                continue;
            }
            String docId = asRequiredText(rawDocRef.get("id"), "docRef.id");
            String name = asOptionalText(rawDocRef.get("name"));
            docRefs.add(buildDocRef(docId, name));
        }
        return docRefs;
    }

    private Map<String, Object> buildDocRef(String docId, String name) {
        Map<String, Object> docRef = new HashMap<>();
        docRef.put("id", docId);
        docRef.put("name", (name == null || name.isBlank()) ? null : name.trim());
        return docRef;
    }

    private String asRequiredText(Object value, String field) {
        return normalizeRequired(value == null ? null : String.valueOf(value), field);
    }

    private String asOptionalText(Object value) {
        if (value == null) {
            return null;
        }
        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String normalizeRequired(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BizException("KB_SKILL-400", field + " required");
        }
        return value.trim();
    }
}
