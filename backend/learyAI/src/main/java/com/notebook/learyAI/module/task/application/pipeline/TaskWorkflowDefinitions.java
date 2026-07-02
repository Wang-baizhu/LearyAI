// Responsibility: Centralize pipeline and stage definitions for orchestration and retry.
package com.notebook.learyAI.module.task.application.pipeline;

import com.notebook.learyAI.shared.exception.BizException;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class TaskWorkflowDefinitions {
    public static final String KBVIEW_PLUGIN_UUID = "44444444-4444-4444-4444-444444444444";
    public static final String DOC_STAGE_RUN_KEY = "doc:main";
    public static final String AGENT_SUMMARY_STAGE_RUN_KEY = "agent:summary";
    public static final String AGENT_SEARCH_STAGE_RUN_KEY = "agent:search";
    public static final String AGENT_KBVIEW_STAGE_RUN_KEY = "agent:kbview";
    public static final String AGENT_PPTPROMPT_STAGE_RUN_KEY = "agent:pptprompt";
    public static final String TEMPLATE_PLUGIN_PUBLISH_STAGE_RUN_KEY = "template-plugin-publish:validate";
    public static final String TEMPLATE_STAGE_RUN_KEY_PREFIX = "agent:template:";
    public static final String AGENT_TASK_TYPE_KB_SUMMARY = "kbsummary";
    public static final String AGENT_TASK_TYPE_SEARCH = "search";
    public static final String AGENT_TASK_TYPE_TEMPLATE = "template";
    public static final String AGENT_TASK_TYPE_KBVIEW = "kbview";
    public static final String AGENT_TASK_TYPE_PPTPROMPT = "pptprompt";

    private TaskWorkflowDefinitions() {
    }

    public static boolean isPipelineType(String type) {
        return TaskTypes.DOCUMENT_PIPELINE.equals(type)
                || TaskTypes.TEMPLATE_PIPELINE.equals(type)
                || TaskTypes.TEMPLATE_PLUGIN_PUBLISH_PIPELINE.equals(type)
                || TaskTypes.AGENT_PIPELINE.equals(type)
                || TaskTypes.SEARCH_PIPELINE.equals(type)
                || TaskTypes.PPTPROMPT_PIPELINE.equals(type);
    }

    public static Map<String, Object> sanitizeSearchPipelineContext(Map<String, Object> pipelineContext) {
        if (pipelineContext == null) {
            throw new BizException("KB-400", "pipelineContext required");
        }
        String query = normalizeRequiredText(pipelineContext.get("query"), "query required");
        List<Map<String, Object>> docRefs = normalizeDocRefs(pipelineContext.get("docRefs"));
        if (docRefs.isEmpty()) {
            throw new BizException("KB-400", "docRefs required");
        }
        Map<String, Object> resolved = new HashMap<>();
        resolved.put("query", query);
        resolved.put("docRefs", docRefs);
        Object info = pipelineContext.get("info");
        if (info instanceof String text && !text.isBlank()) {
            resolved.put("info", text.trim());
        }
        return resolved;
    }

    public static Map<String, Object> sanitizeTemplatePipelineContext(Map<String, Object> pipelineContext) {
        if (pipelineContext == null) {
            throw new BizException("KB-400", "pipelineContext required");
        }
        String pluginId = normalizeRequiredText(pipelineContext.get("pluginId"), "pluginId required");
        Map<String, Object> resolved = new HashMap<>();
        resolved.put("templateId", normalizeRequiredText(pipelineContext.get("templateId"), "templateId required"));
        resolved.put("pluginId", pluginId);
        Object info = pipelineContext.get("info");
        if (info instanceof String text && !text.isBlank()) {
            resolved.put("info", text.trim());
        }
        Map<String, String> promptVars = normalizePromptVars(pipelineContext.get("promptVars"));
        if (!promptVars.isEmpty()) {
            resolved.put("promptVars", promptVars);
        }
        List<Map<String, Object>> docRefs = normalizeDocRefs(pipelineContext.get("docRefs"));
        if (!docRefs.isEmpty()) {
            resolved.put("docRefs", docRefs);
        }
        return resolved;
    }

    public static Map<String, Object> sanitizeAgentPipelineContext(Map<String, Object> pipelineContext) {
        if (pipelineContext == null) {
            throw new BizException("KB-400", "pipelineContext required");
        }
        String pluginId = normalizeRequiredText(pipelineContext.get("pluginId"), "pluginId required");
        if (!isKbviewPluginId(pluginId)) {
            throw new BizException("KB-400", "pluginId invalid");
        }
        Map<String, Object> resolved = new HashMap<>();
        resolved.put("pluginId", pluginId);
        Object info = pipelineContext.get("info");
        if (info instanceof String text && !text.isBlank()) {
            resolved.put("info", text.trim());
        }
        Map<String, String> promptVars = normalizePromptVars(pipelineContext.get("promptVars"));
        if (!promptVars.isEmpty()) {
            resolved.put("promptVars", promptVars);
        }
        return resolved;
    }

    public static Map<String, Object> sanitizePptPromptPipelineContext(Map<String, Object> pipelineContext) {
        if (pipelineContext == null) {
            throw new BizException("KB-400", "pipelineContext required");
        }
        Map<String, Object> resolved = new HashMap<>();
        resolved.put("promptMarkdown", normalizeRequiredText(pipelineContext.get("promptMarkdown"), "promptMarkdown required"));
        Object pageId = pipelineContext.get("pageId");
        if (pageId instanceof String text && !text.isBlank()) {
            resolved.put("pageId", text.trim());
        }
        Object pageTitle = pipelineContext.get("pageTitle");
        if (pageTitle instanceof String text && !text.isBlank()) {
            resolved.put("pageTitle", text.trim());
        }
        Object info = pipelineContext.get("info");
        if (info instanceof String text && !text.isBlank()) {
            resolved.put("info", text.trim());
        }
        return resolved;
    }

    public static Map<String, Object> buildTemplateStagePayload(Map<String, Object> pipelineContext) {
        if (pipelineContext == null) {
            throw new BizException("KB-400", "pipelineContext required");
        }
        String pluginId = normalizeRequiredText(pipelineContext.get("pluginId"), "pluginId required");
        Map<String, Object> stagePayload = new HashMap<>();
        stagePayload.put("templateId", normalizeRequiredText(pipelineContext.get("templateId"), "templateId required"));
        stagePayload.put("pluginId", pluginId);
        stagePayload.put("agentTaskType", AGENT_TASK_TYPE_TEMPLATE);
        Map<String, String> promptVars = normalizePromptVars(pipelineContext.get("promptVars"));
        if (!promptVars.isEmpty()) {
            stagePayload.put("promptVars", promptVars);
        }
        Object info = pipelineContext.get("info");
        if (info instanceof String text && !text.isBlank()) {
            stagePayload.put("info", text.trim());
        }
        List<Map<String, Object>> docRefs = normalizeDocRefs(pipelineContext.get("docRefs"));
        if (!docRefs.isEmpty()) {
            stagePayload.put("docRefs", docRefs);
        }
        return stagePayload;
    }

    public static Map<String, Object> buildAgentStagePayload(Map<String, Object> pipelineContext) {
        Map<String, Object> source = sanitizeAgentPipelineContext(pipelineContext);
        Map<String, Object> stagePayload = new HashMap<>();
        stagePayload.put("pluginId", normalizeRequiredText(source.get("pluginId"), "pluginId required"));
        stagePayload.put("agentTaskType", AGENT_TASK_TYPE_KBVIEW);
        Map<String, String> promptVars = normalizePromptVars(source.get("promptVars"));
        if (!promptVars.isEmpty()) {
            stagePayload.put("promptVars", promptVars);
        }
        Object info = source.get("info");
        if (info instanceof String text && !text.isBlank()) {
            stagePayload.put("info", text.trim());
        }
        return stagePayload;
    }

    public static Map<String, Object> buildPptPromptStagePayload(Map<String, Object> pipelineContext) {
        Map<String, Object> source = sanitizePptPromptPipelineContext(pipelineContext);
        Map<String, Object> stagePayload = new HashMap<>();
        stagePayload.put("agentTaskType", AGENT_TASK_TYPE_PPTPROMPT);
        stagePayload.put("promptVars", Map.of(
                "PROMPT_MARKDOWN", normalizeRequiredText(source.get("promptMarkdown"), "promptMarkdown required")
        ));
        Object info = source.get("info");
        if (info instanceof String text && !text.isBlank()) {
            stagePayload.put("info", text.trim());
        }
        return stagePayload;
    }

    public static String resolveTemplateStageRunKey(Object rawPluginId) {
        String pluginId = normalizeRequiredText(rawPluginId, "pluginId required");
        return TEMPLATE_STAGE_RUN_KEY_PREFIX + pluginId;
    }

    public static TemplateStageDefinition resolveTemplateStageDefinitionByPluginId(Object rawPluginId) {
        return new TemplateStageDefinition(
                AGENT_TASK_TYPE_TEMPLATE,
                resolveTemplateStageRunKey(rawPluginId),
                "模板生成中...",
                "模板生成完成",
                "模板生成失败"
        );
    }

    public static TemplateStageDefinition resolveAgentStageDefinitionByPluginId(Object rawPluginId) {
        if (!isKbviewPluginId(rawPluginId)) {
            throw new BizException("KB-400", "pluginId invalid");
        }
        return new TemplateStageDefinition(
                AGENT_TASK_TYPE_KBVIEW,
                AGENT_KBVIEW_STAGE_RUN_KEY,
                "关系图生成中...",
                "关系图生成完成",
                "关系图生成失败"
        );
    }

    public static Map<String, Object> buildSearchStagePayload(Map<String, Object> pipelineContext) {
        Map<String, Object> source = sanitizeSearchPipelineContext(pipelineContext);
        Map<String, Object> stagePayload = new HashMap<>();
        stagePayload.put("agentTaskType", AGENT_TASK_TYPE_SEARCH);
        stagePayload.put("promptVars", Map.of(
                "CONTENT_TO_EXPLORER", normalizeRequiredText(source.get("query"), "query required")
        ));
        stagePayload.put("docRefs", normalizeDocRefs(source.get("docRefs")));
        Object info = source.get("info");
        if (info instanceof String text && !text.isBlank()) {
            stagePayload.put("info", text.trim());
        }
        return stagePayload;
    }

    public static String resolveAgentTaskType(Object rawAgentTaskType) {
        if (!(rawAgentTaskType instanceof String text) || text.isBlank()) {
            throw new BizException("KB-400", "agentTaskType required");
        }
        String agentTaskType = text.trim().toLowerCase();
        return switch (agentTaskType) {
            case AGENT_TASK_TYPE_KB_SUMMARY, AGENT_TASK_TYPE_SEARCH, AGENT_TASK_TYPE_TEMPLATE,
                    AGENT_TASK_TYPE_KBVIEW, AGENT_TASK_TYPE_PPTPROMPT ->
                    agentTaskType;
            default -> throw new BizException("KB-400", "agentTaskType invalid");
        };
    }

    public static boolean requiresTemplateManifestValidation(Object rawPluginId) {
        return !isKbviewPluginId(rawPluginId);
    }

    public static boolean isKbviewPluginId(Object rawPluginId) {
        if (!(rawPluginId instanceof String text) || text.isBlank()) {
            return false;
        }
        return KBVIEW_PLUGIN_UUID.equals(text.trim());
    }

    public static List<Map<String, Object>> normalizeDocRefs(Object rawDocRefs) {
        if (rawDocRefs == null) {
            return List.of();
        }
        if (!(rawDocRefs instanceof List<?> rawList)) {
            throw new BizException("KB-400", "docRefs invalid");
        }
        List<Map<String, Object>> docRefs = new ArrayList<>();
        for (Object rawItem : rawList) {
            if (!(rawItem instanceof Map<?, ?> rawMap)) {
                throw new BizException("KB-400", "docRefs invalid");
            }
            Object rawId = rawMap.get("id");
            if (!(rawId instanceof String idText) || idText.isBlank()) {
                throw new BizException("KB-400", "docRefs invalid");
            }
            Map<String, Object> docRef = new HashMap<>();
            docRef.put("id", idText.trim());
            Object rawName = rawMap.get("name");
            if (rawName instanceof String nameText && !nameText.isBlank()) {
                docRef.put("name", nameText.trim());
            } else {
                docRef.put("name", null);
            }
            docRefs.add(docRef);
        }
        return docRefs;
    }

    public static Map<String, String> normalizePromptVars(Object rawPromptVars) {
        if (rawPromptVars == null) {
            return Map.of();
        }
        if (!(rawPromptVars instanceof Map<?, ?> rawMap)) {
            throw new BizException("KB-400", "promptVars invalid");
        }
        Map<String, String> promptVars = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : rawMap.entrySet()) {
            if (!(entry.getKey() instanceof String keyText) || keyText.isBlank()) {
                throw new BizException("KB-400", "promptVars invalid");
            }
            if (!(entry.getValue() instanceof String valueText)) {
                throw new BizException("KB-400", "promptVars invalid");
            }
            promptVars.put(keyText.trim(), valueText.trim());
        }
        return promptVars;
    }

    public record TemplateStageDefinition(String agentTaskType,
                                          String stageRunKey,
                                          String processingInfo,
                                          String doneInfo,
                                          String failedInfo) {}

    public static String normalizeRequiredText(Object rawValue, String message) {
        if (!(rawValue instanceof String text) || text.isBlank()) {
            throw new BizException("KB-400", message);
        }
        return text.trim();
    }

}
