// taskSse.helpers 负责沉淀任务 SSE 的纯逻辑辅助函数，供运行时与单元测试复用。
import { parseTaskStage, resolveTaskFamily } from '../taskPresentation';

type TaskSsePayload = {
  taskId?: string;
  projectId?: string;
  kbId?: string;
  pipelineType?: string;
  status?: string;
  updatedAt?: string;
  revision?: number;
  changeType?: string;
  currentStage?: string | null;
  viewData?: Record<string, unknown> | null;
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value));

export const parseTaskPayload = (raw: string): TaskSsePayload | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return isRecord(parsed) ? (parsed as TaskSsePayload) : null;
  } catch {
    return null;
  }
};

export const resolveTemplatePluginIdFromTask = (pipelineType?: string, currentStage?: string | null) => {
  if (resolveTaskFamily(pipelineType, currentStage) !== 'template') {
    return null;
  }
  return parseTaskStage(currentStage).templatePluginId ?? null;
};

export const isDocumentTask = (pipelineType?: string, currentStage?: string | null) =>
  resolveTaskFamily(pipelineType, currentStage) === 'document';

export const shouldMatchProject = (projectId: string | undefined, queryProjectId: unknown) => {
  if (!projectId) return true;
  if (typeof queryProjectId !== 'string') return false;
  return queryProjectId === projectId;
};

export const shouldMatchKbId = (kbId: string | undefined, queryKbId: unknown) => {
  if (!kbId) return true;
  if (typeof queryKbId !== 'string') return false;
  return queryKbId === kbId;
};

export const normalizeScope = (projectId?: string, kbId?: string) => ({
  projectId: projectId?.trim() ?? '',
  kbId: kbId?.trim() ?? '',
});

export const resolveFailedMessage = (
  pipelineType?: string,
  currentStage?: string | null,
  viewData?: Record<string, unknown> | null,
) => {
  const failedReason = typeof viewData?.failedReason === 'string' ? viewData.failedReason.trim() : '';
  const family = resolveTaskFamily(pipelineType, currentStage);
  const prefix = family === 'document'
    ? '文档任务处理失败'
    : family === 'kbview'
      ? '关系图任务处理失败'
      : family === 'template'
        ? '模板任务处理失败'
        : family === 'pptprompt'
          ? 'PPT Prompt 任务处理失败'
        : pipelineType === 'agent_pipeline'
          ? '智能体任务处理失败'
        : '任务处理失败';
  if (failedReason) {
    return `${prefix}：${failedReason}`;
  }
  return `${prefix}，请重试。`;
};

export type { TaskSsePayload };
