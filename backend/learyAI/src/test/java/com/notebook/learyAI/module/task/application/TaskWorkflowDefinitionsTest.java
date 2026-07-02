// Responsibility: Verify template pipeline context normalization and stage payload projection.
package com.notebook.learyAI.module.task.application;

import com.notebook.learyAI.module.task.application.pipeline.TaskWorkflowDefinitions;
import com.notebook.learyAI.shared.exception.BizException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TaskWorkflowDefinitionsTest {
    @Test
    @DisplayName("sanitizeTemplatePipelineContext: 应保留 pluginId、info、docRefs 与 promptVars")
    void sanitizeTemplatePipelineContext_shouldKeepPromptVars() {
        Map<String, Object> resolved = TaskWorkflowDefinitions.sanitizeTemplatePipelineContext(Map.of(
                "templateId", "tpl-1",
                "pluginId", "mindmap",
                "info", "补充上下文",
                "promptVars", Map.of("focus", "第二章", "tone", "简洁"),
                "docRefs", List.of(Map.of("id", "doc-1", "name", "D1"))
        ));

        assertEquals("tpl-1", resolved.get("templateId"));
        assertEquals("mindmap", resolved.get("pluginId"));
        assertEquals("补充上下文", resolved.get("info"));
        assertEquals(Map.of("focus", "第二章", "tone", "简洁"), resolved.get("promptVars"));
        assertEquals(List.of(Map.of("id", "doc-1", "name", "D1")), resolved.get("docRefs"));
    }

    @Test
    @DisplayName("buildTemplateStagePayload: 应透传 template agentTaskType、promptVars 与 info 并去掉运行时字段")
    void buildTemplateStagePayload_shouldProjectPromptVarsWithoutPrompt() {
        Map<String, Object> stagePayload = TaskWorkflowDefinitions.buildTemplateStagePayload(Map.of(
                "templateId", "tpl-2",
                "pluginId", "quiz",
                "info", "补充上下文",
                "promptVars", Map.of("difficulty", "高"),
                "docRefs", List.of(Map.of("id", "doc-1", "name", "D1"))
        ));

        assertEquals("tpl-2", stagePayload.get("templateId"));
        assertEquals("quiz", stagePayload.get("pluginId"));
        assertEquals("template", stagePayload.get("agentTaskType"));
        assertEquals("补充上下文", stagePayload.get("info"));
        assertEquals(Map.of("difficulty", "高"), stagePayload.get("promptVars"));
        assertFalse(stagePayload.containsKey("kbId"));
        assertFalse(stagePayload.containsKey("templateType"));
    }

    @Test
    @DisplayName("resolveTemplateStageDefinitionByPluginId: 应映射到 pluginId 维度阶段")
    void resolveTemplateStageDefinitionByPluginId_shouldResolveTemplateStage() {
        TaskWorkflowDefinitions.TemplateStageDefinition definition =
                TaskWorkflowDefinitions.resolveTemplateStageDefinitionByPluginId("plugin-uuid");

        assertEquals("template", definition.agentTaskType());
        assertEquals("agent:template:plugin-uuid", definition.stageRunKey());
        assertEquals("模板生成中...", definition.processingInfo());
    }

    @Test
    @DisplayName("resolveTemplateStageRunKey: 应拼接 agent:template:pluginId")
    void resolveTemplateStageRunKey_shouldUsePluginId() {
        assertEquals("agent:template:plugin-uuid", TaskWorkflowDefinitions.resolveTemplateStageRunKey("plugin-uuid"));
    }

    @Test
    @DisplayName("sanitizeAgentPipelineContext: kbview 应保留 pluginId、info 与 promptVars")
    void sanitizeAgentPipelineContext_shouldKeepKbviewFields() {
        Map<String, Object> resolved = TaskWorkflowDefinitions.sanitizeAgentPipelineContext(Map.of(
                "pluginId", TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID,
                "info", "关系图补充上下文",
                "promptVars", Map.of("focus", "关键主题")
        ));

        assertEquals(TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID, resolved.get("pluginId"));
        assertEquals("关系图补充上下文", resolved.get("info"));
        assertEquals(Map.of("focus", "关键主题"), resolved.get("promptVars"));
    }

    @Test
    @DisplayName("buildAgentStagePayload: kbview 应投影为 kbview agentTaskType")
    void buildAgentStagePayload_shouldProjectKbviewStagePayload() {
        Map<String, Object> stagePayload = TaskWorkflowDefinitions.buildAgentStagePayload(Map.of(
                "pluginId", TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID,
                "info", "关系图补充上下文",
                "promptVars", Map.of("focus", "关键主题")
        ));

        assertEquals(TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID, stagePayload.get("pluginId"));
        assertEquals(TaskWorkflowDefinitions.AGENT_TASK_TYPE_KBVIEW, stagePayload.get("agentTaskType"));
        assertEquals("关系图补充上下文", stagePayload.get("info"));
        assertEquals(Map.of("focus", "关键主题"), stagePayload.get("promptVars"));
    }

    @Test
    @DisplayName("resolveAgentStageDefinitionByPluginId: kbview 应映射到固定 agent:kbview 阶段")
    void resolveAgentStageDefinitionByPluginId_shouldResolveKbviewStage() {
        TaskWorkflowDefinitions.TemplateStageDefinition definition =
                TaskWorkflowDefinitions.resolveAgentStageDefinitionByPluginId(TaskWorkflowDefinitions.KBVIEW_PLUGIN_UUID);

        assertEquals(TaskWorkflowDefinitions.AGENT_TASK_TYPE_KBVIEW, definition.agentTaskType());
        assertEquals(TaskWorkflowDefinitions.AGENT_KBVIEW_STAGE_RUN_KEY, definition.stageRunKey());
        assertEquals("关系图生成中...", definition.processingInfo());
    }

    @Test
    @DisplayName("sanitizePptPromptPipelineContext: 应保留 promptMarkdown 与页面信息")
    void sanitizePptPromptPipelineContext_shouldKeepPromptMarkdown() {
        Map<String, Object> resolved = TaskWorkflowDefinitions.sanitizePptPromptPipelineContext(Map.of(
                "promptMarkdown", "# 标题\n- 第一段",
                "pageId", "page-1",
                "pageTitle", "封面页",
                "info", "准备生成 PPT Prompt"
        ));

        assertEquals("# 标题\n- 第一段", resolved.get("promptMarkdown"));
        assertEquals("page-1", resolved.get("pageId"));
        assertEquals("封面页", resolved.get("pageTitle"));
        assertEquals("准备生成 PPT Prompt", resolved.get("info"));
    }

    @Test
    @DisplayName("buildPptPromptStagePayload: 应投影为 pptprompt agentTaskType")
    void buildPptPromptStagePayload_shouldProjectPromptMarkdown() {
        Map<String, Object> stagePayload = TaskWorkflowDefinitions.buildPptPromptStagePayload(Map.of(
                "promptMarkdown", "body_1: 第一段",
                "info", "准备生成 PPT Prompt"
        ));

        assertEquals(TaskWorkflowDefinitions.AGENT_TASK_TYPE_PPTPROMPT, stagePayload.get("agentTaskType"));
        assertEquals(Map.of("PROMPT_MARKDOWN", "body_1: 第一段"), stagePayload.get("promptVars"));
        assertEquals("准备生成 PPT Prompt", stagePayload.get("info"));
    }

    @Test
    @DisplayName("normalizePromptVars: 非字符串值应直接报错")
    void normalizePromptVars_whenValueInvalid_shouldThrowKb400() {
        BizException ex = assertThrows(BizException.class,
                () -> TaskWorkflowDefinitions.normalizePromptVars(Map.of("focus", 1)));

        assertEquals("KB-400", ex.getCode());
    }

    @Test
    @DisplayName("normalizePromptVars: 空字符串值应保留供 flow 占位变量使用")
    void normalizePromptVars_whenValueBlank_shouldKeepEmptyString() {
        Map<String, String> promptVars = TaskWorkflowDefinitions.normalizePromptVars(Map.of("CUSTOM_PROMPT", "   "));

        assertTrue(promptVars.containsKey("CUSTOM_PROMPT"));
        assertEquals("", promptVars.get("CUSTOM_PROMPT"));
    }
}
