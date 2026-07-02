// Responsibility: Verify KbDocTaskStatusListener sync boundary for doc-only and orchestration change types.
package com.notebook.learyAI.module.kbdoc.application;

import com.notebook.learyAI.module.kbdoc.application.cache.KbDocQueryCache;
import com.notebook.learyAI.module.kbdoc.domain.repository.KbDocRepository;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Map;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class KbDocTaskStatusListenerTest {
    @Mock
    private KbDocRepository kbDocRepository;
    @Mock
    private KbDocQueryCache kbDocQueryCache;
    @Mock
    private TaskAppService taskAppService;

    @Test
    @DisplayName("onStatusChanged: 编排变更类型不应同步 kbdoc 状态")
    void onStatusChanged_whenOrchestrationChangeType_shouldIgnore() {
        KbDocTaskStatusListener listener = new KbDocTaskStatusListener(kbDocRepository, kbDocQueryCache, taskAppService);
        Task task = new Task(1L, "task-1", "p1", "kb-1", 2L, "document_pipeline", TaskStatus.FAILED,
                null, "{\"kbId\":\"kb-1\",\"docId\":\"doc-1\"}", null, null, Instant.now(), Instant.now());

        listener.onStatusChanged(task, TaskStatus.PROCESSING, "agent_child_failed");

        verify(kbDocRepository, never()).updateStatusByDocId("p1", "doc-1", "FAILED");
        verify(kbDocQueryCache, never()).evictDocByDocId("p1", "doc-1");
    }

    @Test
    @DisplayName("onStatusChanged: 缺少 legacy typeId 时应回退读取 pipelineContext.docId")
    void onStatusChanged_whenTypeIdMissing_shouldReadDocIdFromPipelineContext() {
        KbDocTaskStatusListener listener = new KbDocTaskStatusListener(kbDocRepository, kbDocQueryCache, taskAppService);
        Task task = new Task(1L, "task-1", "p1", "kb-1", 2L, "document_pipeline", TaskStatus.DONE,
                null, "{\"kbId\":\"kb-1\",\"docId\":\"doc-1\"}", null, null, Instant.now(), Instant.now());
        when(taskAppService.readPipelineContext(task)).thenReturn(Map.of("docId", "doc-1"));

        listener.onStatusChanged(task, TaskStatus.PROCESSING, "status_change");

        verify(kbDocRepository).updateStatusByDocId("p1", "doc-1", "DONE");
        verify(kbDocQueryCache).evictDocByDocId("p1", "doc-1");
    }
}
