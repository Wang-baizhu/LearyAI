// Responsibility: Handle task status changes for downstream modules.
package com.notebook.learyAI.module.task.application.status;

import com.notebook.learyAI.module.task.domain.model.Task;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;

public interface TaskStatusListener {
    void onStatusChanged(Task task, TaskStatus prevStatus, String changeType);
}
