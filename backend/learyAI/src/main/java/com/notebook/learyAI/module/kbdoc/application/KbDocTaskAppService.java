// Responsibility: Handle knowledge base document task use cases.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
public class KbDocTaskAppService {
    private final TaskAppService taskAppService;
    private final KbDocAppSupport support;

    public KbDocTaskAppService(TaskAppService taskAppService,
                               KbDocAppSupport support) {
        this.taskAppService = taskAppService;
        this.support = support;
    }

    public Map<String, String> loadLatestDocStatuses(String projectId, List<String> docIds) {
        Long userId = support.requireUserId();
        String normalizedProjectId = support.requireProjectId(projectId);
        support.requireRole(normalizedProjectId, userId);
        Map<String, String> statuses = new HashMap<>();
        if (docIds == null || docIds.isEmpty()) {
            return statuses;
        }
        for (String docId : docIds) {
            if (docId == null || docId.isBlank()) {
                continue;
            }
            taskAppService.findLatestDocumentPipelineByDocId(normalizedProjectId, docId)
                    .map(Task::getStatus)
                    .filter(Objects::nonNull)
                    .map(TaskStatus::name)
                    .ifPresent(status -> statuses.put(docId, status));
        }
        return statuses;
    }
}
