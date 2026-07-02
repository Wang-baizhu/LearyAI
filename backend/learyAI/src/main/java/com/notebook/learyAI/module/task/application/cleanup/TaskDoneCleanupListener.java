// Responsibility: Keep task retention policy hook (DONE cleanup disabled; rely on TTL strategy).
package com.notebook.learyAI.module.task.application.cleanup;

import com.notebook.learyAI.module.task.application.status.TaskStatusListener;
import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Component;

@Component
public class TaskDoneCleanupListener implements TaskStatusListener {
    @Override
    public void onStatusChanged(Task task, TaskStatus prevStatus, String changeType) {
        // 任务保留策略调整：DONE 不再立即删除，后续由 TTL 清理策略处理。
    }
}
