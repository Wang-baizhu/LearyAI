// taskPresentation 负责基于 pipelineType 与 currentStage 解析任务展示语义。
import type { TaskListItem } from './types';

const TEMPLATE_STAGE_PREFIX = 'agent:template:';
const TEMPLATE_PLUGIN_FALLBACK_LABELS: Record<string, string> = {
  card: '卡片',
  'plugin-card': '卡片',
  mindmap: '思维导图',
  'plugin-mindmap': '思维导图',
  quiz: '题目',
  'plugin-quiz': '题目',
};

type TaskFamily = 'document' | 'template' | 'kbview' | 'search' | 'pptprompt' | 'unknown';
type TaskStageKind = 'doc_parse' | 'summary_generate' | 'template_generate' | 'kbview_generate' | 'pptprompt_generate' | 'unknown';

export interface ParsedTaskStage {
  kind: TaskStageKind;
  raw: string | null;
  templatePluginId?: string;
}

export interface TaskPresentation {
  family: TaskFamily;
  pipelineLabel: string;
  stageLabel: string;
  templatePluginId?: string;
}

export interface TaskPluginSummary {
  displayName?: string;
}

export const parseTaskStage = (currentStage?: string | null): ParsedTaskStage => {
  const raw = typeof currentStage === 'string' ? currentStage.trim() : '';
  if (!raw) {
    return {
      kind: 'unknown',
      raw: null,
    };
  }
  if (raw === 'doc:main') {
    return { kind: 'doc_parse', raw };
  }
  if (raw === 'agent:summary') {
    return { kind: 'summary_generate', raw };
  }
  if (raw === 'agent:kbview') {
    return { kind: 'kbview_generate', raw };
  }
  if (raw === 'agent:pptprompt') {
    return { kind: 'pptprompt_generate', raw };
  }
  if (raw.startsWith(TEMPLATE_STAGE_PREFIX)) {
    const templatePluginId = raw.slice(TEMPLATE_STAGE_PREFIX.length).trim();
    return {
      kind: 'template_generate',
      raw,
      templatePluginId: templatePluginId || undefined,
    };
  }
  return {
    kind: 'unknown',
    raw,
  };
};

export const resolveTaskFamily = (pipelineType?: string | null, currentStage?: string | null): TaskFamily => {
  const stage = parseTaskStage(currentStage);
  if (pipelineType === 'document_pipeline') return 'document';
  if (pipelineType === 'template_pipeline') return 'template';
  if (pipelineType === 'agent_pipeline' && stage.kind === 'kbview_generate') return 'kbview';
  if (pipelineType === 'search_pipeline') return 'search';
  if (pipelineType === 'pptprompt_pipeline') return 'pptprompt';
  return 'unknown';
};

export const resolveTemplatePluginDisplayName = (
  pluginId: string | undefined,
  pluginById: Record<string, TaskPluginSummary>,
) => {
  if (!pluginId) return null;
  const plugin = pluginById[pluginId];
  const displayName = plugin?.displayName?.trim();
  if (displayName) {
    return displayName;
  }
  return TEMPLATE_PLUGIN_FALLBACK_LABELS[pluginId] ?? null;
};

export const resolveTaskPresentation = (
  task: Pick<TaskListItem, 'type' | 'currentStage'>,
  pluginById: Record<string, TaskPluginSummary>,
): TaskPresentation => {
  const stage = parseTaskStage(task.currentStage);
  const family = resolveTaskFamily(task.type, task.currentStage);
  const templateDisplayName = resolveTemplatePluginDisplayName(stage.templatePluginId, pluginById);

  if (family === 'document') {
    if (stage.kind === 'doc_parse') {
      return { family, pipelineLabel: '文档', stageLabel: '文档解析' };
    }
    if (stage.kind === 'summary_generate') {
      return { family, pipelineLabel: '文档', stageLabel: '摘要生成' };
    }
    return { family, pipelineLabel: '文档', stageLabel: '处理中' };
  }
  if (family === 'template') {
    const pipelineLabel = templateDisplayName ?? '模板';
    return {
      family,
      pipelineLabel,
      stageLabel: `${pipelineLabel}生成`,
      templatePluginId: stage.templatePluginId,
    };
  }
  if (family === 'kbview') {
    return { family, pipelineLabel: '关系图', stageLabel: '关系图生成' };
  }
  if (family === 'search') {
    return { family, pipelineLabel: '搜索', stageLabel: '搜索处理' };
  }
  if (family === 'pptprompt') {
    return { family, pipelineLabel: 'PPT Prompt', stageLabel: 'PPT 内容生成' };
  }
  if (task.type === 'agent_pipeline') {
    return {
      family,
      pipelineLabel: '智能体任务',
      stageLabel: stage.raw ?? '处理中',
      templatePluginId: stage.templatePluginId,
    };
  }
  return {
    family,
    pipelineLabel: '任务',
    stageLabel: stage.raw ?? '处理中',
    templatePluginId: stage.templatePluginId,
  };
};
