// Responsibility: Sync document status when task status changes.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.status.TaskStatusListener;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Component;

@Component
public class KbDocTaskStatusListener implements TaskStatusListener {
    private static final String TASK_TYPE_DOCUMENT_PIPELINE = "document_pipeline";
    private static final String CHANGE_TYPE_DOC_STAGE_DONE = "doc_stage_done";
    private static final String CHANGE_TYPE_AGENT_CHILD_DONE = "agent_child_done";
    private static final String CHANGE_TYPE_AGENT_CHILD_FAILED = "agent_child_failed";
    private static final String CHANGE_TYPE_RETRY_AGENT_CHILD = "retry_agent_child";

    private final KbDocRepository docRepository;
    private final KbDocQueryCache kbDocQueryCache;
    private final TaskAppService taskAppService;

    public KbDocTaskStatusListener(KbDocRepository docRepository,
                                   KbDocQueryCache kbDocQueryCache,
                                   TaskAppService taskAppService) {
        this.docRepository = docRepository;
        this.kbDocQueryCache = kbDocQueryCache;
        this.taskAppService = taskAppService;
    }

    @Override
    public void onStatusChanged(Task task, TaskStatus prevStatus, String changeType) {
        if (task == null || task.getType() == null) {
            return;
        }
        if (!TASK_TYPE_DOCUMENT_PIPELINE.equals(task.getType())) {
            return;
        }
        if (CHANGE_TYPE_DOC_STAGE_DONE.equals(changeType)
                || CHANGE_TYPE_AGENT_CHILD_DONE.equals(changeType)
                || CHANGE_TYPE_AGENT_CHILD_FAILED.equals(changeType)
                || CHANGE_TYPE_RETRY_AGENT_CHILD.equals(changeType)) {
            return;
        }
        String typeId = task.getTypeId();
        if (typeId == null || typeId.isBlank()) {
            Object rawDocId = taskAppService.readPipelineContext(task).get("docId");
            if (!(rawDocId instanceof String text) || text.isBlank()) {
                return;
            }
            typeId = text.trim();
        }
        docRepository.updateStatusByDocId(task.getProjectId(), typeId, task.getStatus().name());
        kbDocQueryCache.evictDocByDocId(task.getProjectId(), typeId);
    }
}
