// Responsibility: Handle template plugin publish validation stage status projection.
package com.notebook.learyAI.module.task.application.orchestration;

import com.notebook.learyAI.module.task.application.pipeline.TaskTypes;
import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.module.task.application.service.TaskAppService;
import com.notebook.learyAI.module.task.application.service.TaskStatusService;
import com.notebook.learyAI.module.task.domain.model.TaskStatus;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;

@Component
public class TemplatePluginPublishTaskStageStatusHandler implements TaskStageStatusHandler {
    private final TaskAppService taskAppService;
    private final TaskStatusService taskStatusService;

    public TemplatePluginPublishTaskStageStatusHandler(TaskAppService taskAppService,
                                                       TaskStatusService taskStatusService) {
        this.taskAppService = taskAppService;
        this.taskStatusService = taskStatusService;
    }

    @Override
    public String executorType() {
        return TaskTypes.TEMPLATE_PLUGIN_PUBLISH;
    }

    @Override
    public void onStageStatusChanged(TaskStageStatusContext context) {
        Map<String, Object> patch = buildViewDataPatch(
                context.status(),
                taskAppService.readPipelineContext(context.parentTask()),
                context.result(),
                context.info()
        );
        if (context.status() == TaskStatus.DONE) {
            taskStatusService.updateTaskStatus(
                    context.parentTask().getTaskRecordId(),
                    context.parentTask().getProjectId(),
                    TaskStatus.DONE,
                    patch,
                    null,
                    normalizeChangeType(context.changeType(), "template_plugin_publish_done")
            );
            return;
        }
        if (context.status() == TaskStatus.FAILED) {
            taskStatusService.updateTaskStatus(
                    context.parentTask().getTaskRecordId(),
                    context.parentTask().getProjectId(),
                    TaskStatus.FAILED,
                    patch,
                    context.info(),
                    normalizeChangeType(context.changeType(), "template_plugin_publish_failed")
            );
        }
    }

    private Map<String, Object> buildViewDataPatch(TaskStatus status,
                                                   Map<String, Object> pipelineContext,
                                                   Map<String, Object> result,
                                                   String info) {
        Map<String, Object> patch = new HashMap<>();
        patch.put("stage", TaskStagePatchSupport.buildStage(
                TaskTypes.TEMPLATE_PLUGIN_PUBLISH,
                TaskWorkflowDefinitions.TEMPLATE_PLUGIN_PUBLISH_STAGE_RUN_KEY,
                status
        ));
        Object pluginId = pipelineContext == null ? null : pipelineContext.get("pluginId");
        if (pluginId instanceof String text && !text.isBlank()) {
            patch.put("pluginId", text.trim());
        }
        String resolvedInfo = info;
        if (resolvedInfo == null || resolvedInfo.isBlank()) {
            resolvedInfo = switch (status) {
                case PROCESSING -> "模板插件发布校验中...";
                case DONE -> "模板插件发布完成";
                case FAILED -> "模板插件发布失败";
                default -> null;
            };
        }
        TaskStagePatchSupport.putText(patch, "info", resolvedInfo);
        if (status == TaskStatus.PROCESSING) {
            TaskStagePatchSupport.putText(patch, "progressText", resolvedInfo);
            return patch;
        }
        if (status == TaskStatus.FAILED) {
            TaskStagePatchSupport.putText(patch, "failedReason", resolvedInfo);
            return patch;
        }
        if (status == TaskStatus.DONE && result != null && !result.isEmpty()) {
            TaskStagePatchSupport.putText(patch, "summary", TaskStagePatchSupport.readText(result.get("outputText")));
            patch.put("output", new HashMap<>(result));
        }
        return patch;
    }

    private String normalizeChangeType(String origin, String fallback) {
        if (origin == null || origin.isBlank()) {
            return fallback;
        }
        return origin.trim();
    }
}
