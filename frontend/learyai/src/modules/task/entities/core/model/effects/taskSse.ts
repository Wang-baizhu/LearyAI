// taskSse 负责在上传确认后建立任务 SSE 连接并触发资源刷新。
import type { InfiniteData } from '@tanstack/react-query';
import { queryClient } from '@/shared/query/queryClient';
import { buildSseUrl } from '@/shared/config/endpoints';
import { store } from '@/app/store';
import { enqueueToast } from '@/app/store/ui/toastSlice';
import type { TaskListItem, TaskListResponse } from '../types';
import {
  isDocumentTask,
  normalizeScope,
  parseTaskPayload,
  resolveFailedMessage,
  resolveTemplatePluginIdFromTask,
  shouldMatchKbId,
  shouldMatchProject,
} from './taskSse.helpers';
type TaskListQueryKey = ['task', 'list', Record<string, unknown>?];
type TaskListCache = TaskListResponse | InfiniteData<TaskListResponse>;
type InProgressTaskStatus = 'UPLOADING' | 'UPLOADED' | 'PROCESSING';

const IN_PROGRESS_STATUS_SET: Set<InProgressTaskStatus> = new Set(['UPLOADING', 'UPLOADED', 'PROCESSING']);
const failedToastTaskIds = new Set<string>();

let taskEventSource: EventSource | null = null;
let taskSseReadyPromise: Promise<void> | null = null;
let taskSseScope: { projectId: string; kbId: string } | null = null;

const resolveSseUrl = (projectId?: string, kbId?: string) => {
  if (!projectId) {
    throw new Error('缺少 projectId，无法建立任务 SSE 连接');
  }
  if (!kbId) {
    throw new Error('缺少 kbId，无法建立任务 SSE 连接');
  }
  const query = `?projectId=${encodeURIComponent(projectId)}&kbId=${encodeURIComponent(kbId)}`;
  return buildSseUrl('/tasks', query);
};

const isSameScope = (projectId?: string, kbId?: string) => {
  if (!taskSseScope) return false;
  const next = normalizeScope(projectId, kbId);
  return taskSseScope.projectId === next.projectId && taskSseScope.kbId === next.kbId;
};

const cleanupTaskSse = () => {
  if (!taskEventSource) return;
  taskEventSource.close();
  taskEventSource = null;
  taskSseScope = null;
  taskSseReadyPromise = null;
};

const resolveTaskListPages = (data?: TaskListCache) => {
  if (!data) {
    return [];
  }
  if ('pages' in data && Array.isArray(data.pages)) {
    return data.pages;
  }
  return [data];
};

const resolveTaskListItems = (data?: TaskListCache): TaskListItem[] =>
  resolveTaskListPages(data).flatMap((page) => ('items' in page ? page.items : []));

const hasInProgressTasks = (projectId: string | undefined, kbId: string | undefined, taskId?: string, taskStatus?: string) => {
  const taskQueries = queryClient.getQueriesData<TaskListCache>({ queryKey: ['task', 'list'] });
  for (const [queryKey, data] of taskQueries) {
    const key = queryKey as TaskListQueryKey;
    const params = key[2];
    if (!shouldMatchProject(projectId, params?.projectId)) {
      continue;
    }
    if (!shouldMatchKbId(kbId, params?.kbId)) {
      continue;
    }
    const hasInProgress = resolveTaskListItems(data).some((item) => {
      const latestStatus =
        typeof taskId === 'string' && item.taskId === taskId && typeof taskStatus === 'string'
          ? taskStatus
          : item.status;
      return IN_PROGRESS_STATUS_SET.has(latestStatus as InProgressTaskStatus);
    });
    if (hasInProgress) {
      return true;
    }
  }
  return false;
};

export const closeTaskSse = (projectId?: string, kbId?: string) => {
  if (!taskEventSource) return;
  if ((projectId || kbId) && !isSameScope(projectId, kbId)) return;
  console.info('[TaskSSE] closed');
  cleanupTaskSse();
};

// 供外部检查任务 SSE 连接状态，当前在文件上传完成和刷新时有任务时触发。
export const ensureTaskSseConnected = (projectId?: string, kbId?: string) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return;
  }
  if (taskEventSource && taskEventSource.readyState !== EventSource.CLOSED && isSameScope(projectId, kbId)) {
    return;
  }
  if (taskEventSource && taskEventSource.readyState !== EventSource.CLOSED) {
    cleanupTaskSse();
  }
  const url = resolveSseUrl(projectId, kbId);
  const scope = normalizeScope(projectId, kbId);
  const source = new EventSource(url, { withCredentials: true });
  const handleOpen = () => {
    console.info('[TaskSSE] connected', { url });
  };
  const handleTaskStatus = (event: MessageEvent) => {
    console.info('[TaskSSE] task-status', { lastEventId: event.lastEventId, data: event.data });
    const payload = parseTaskPayload(String(event.data ?? ''));
    const status = payload?.status;
    const projectId = payload?.projectId;
    const pipelineType = payload?.pipelineType;
    const currentStage = payload?.currentStage;
    const viewData = payload?.viewData ?? null;
    const taskId = typeof payload?.taskId === 'string' && payload.taskId.trim() ? payload.taskId.trim() : undefined;
    const kbId = typeof payload?.kbId === 'string' ? payload.kbId : undefined;
    const templatePluginId = resolveTemplatePluginIdFromTask(pipelineType, currentStage);
    const docTask = isDocumentTask(pipelineType, currentStage);

    queryClient.refetchQueries({
      predicate: (query) => {
        const key = query.queryKey;
        if (key[0] !== 'task' || key[1] !== 'list') return false;
        const params = key[2] as Record<string, unknown> | undefined;
        if (!shouldMatchProject(projectId, params?.projectId)) return false;
        if (!shouldMatchKbId(kbId, params?.kbId)) return false;
        return true;
      },
      type: 'active',
    });

    if (status === 'FAILED') {
      if (typeof taskId === 'string' && projectId && !failedToastTaskIds.has(taskId)) {
        failedToastTaskIds.add(taskId);
        store.dispatch(
          enqueueToast({
            variant: 'error',
            message: resolveFailedMessage(pipelineType, currentStage, viewData),
            durationMs: 8000,
          })
        );
      }
      if (!hasInProgressTasks(projectId, kbId, taskId, status)) {
        closeTaskSse(projectId, kbId);
      }
      return;
    }

    if (typeof taskId === 'string') {
      failedToastTaskIds.delete(taskId);
    }

    if (status !== 'DONE') {
      return;
    }

    if (templatePluginId) {
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'resource-center' || key[1] !== 'template-list') return false;
          if (!shouldMatchProject(projectId, key[2])) return false;
          if (!shouldMatchKbId(kbId, key[3])) return false;
          if (key[4] !== 'all' && key[4] !== templatePluginId) return false;
          if (key[5] !== templatePluginId) return false;
          if (typeof key[9] === 'number' && key[9] !== 1) return false;
          return true;
        },
        type: 'active',
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'resource-center' || key[1] !== 'template-facets') return false;
          if (!shouldMatchProject(projectId, key[2])) return false;
          if (!shouldMatchKbId(kbId, key[3])) return false;
          if (key[4] !== templatePluginId) return false;
          if (key[5] !== templatePluginId) return false;
          return true;
        },
        type: 'active',
      });
      return;
    }

    if (docTask) {
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'resource' || key[1] !== 'list') return false;
          const params = key[2] as Record<string, unknown> | undefined;
          if (!shouldMatchProject(projectId, params?.projectId)) return false;
          if (!shouldMatchKbId(kbId, params?.kbId)) return false;
          if (typeof params?.page === 'number' && params.page !== 1) return false;
          return true;
        },
        type: 'active',
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'resource' || key[1] !== 'options') return false;
          const params = key[2] as Record<string, unknown> | undefined;
          if (!shouldMatchProject(projectId, params?.projectId)) return false;
          if (!shouldMatchKbId(kbId, params?.kbId)) return false;
          return true;
        },
        type: 'active',
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'resource' || key[1] !== 'aggregated') return false;
          const params = key[3] as Record<string, unknown> | undefined;
          if (!shouldMatchProject(projectId, params?.projectId)) return false;
          if (!shouldMatchKbId(kbId, params?.kbId)) return false;
          if (typeof params?.page === 'number' && params.page !== 1) return false;
          return true;
        },
        type: 'active',
      });
      queryClient.refetchQueries({
        predicate: (query) => {
          const key = query.queryKey;
          if (key[0] !== 'resource' || key[1] !== 'recent') return false;
          return shouldMatchProject(projectId, key[2]);
        },
        type: 'active',
      });
    }
  };
  const handleError = () => {
    console.warn('[TaskSSE] error', { readyState: source.readyState });
    if (source.readyState === EventSource.CLOSED) {
      cleanupTaskSse();
    }
  };
  source.addEventListener('open', handleOpen);
  source.addEventListener('task-status', handleTaskStatus);
  source.addEventListener('error', handleError);
  taskEventSource = source;
  taskSseScope = scope;
};

export const ensureTaskSseReady = async (projectId?: string, kbId?: string, timeoutMs = 3000) => {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    throw new Error('SSE 不可用');
  }
  ensureTaskSseConnected(projectId, kbId);
  const source = taskEventSource;
  if (!source) {
    throw new Error('SSE 初始化失败');
  }
  if (!isSameScope(projectId, kbId)) {
    throw new Error('SSE 作用域不匹配');
  }
  if (source.readyState === EventSource.OPEN) {
    return;
  }
  if (taskSseReadyPromise) {
    return taskSseReadyPromise;
  }
  taskSseReadyPromise = new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      if (settled) return;
      settled = true;
      source.removeEventListener('open', handleOpen);
      source.removeEventListener('error', handleError);
      window.clearTimeout(timeoutId);
    };
    const handleOpen = () => {
      cleanup();
      resolve();
    };
    const handleError = () => {
      if (source.readyState === EventSource.CLOSED) {
        cleanup();
        reject(new Error('SSE 连接失败'));
      }
    };
    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error('SSE 连接超时'));
    }, timeoutMs);
    source.addEventListener('open', handleOpen);
    source.addEventListener('error', handleError);
  }).finally(() => {
    taskSseReadyPromise = null;
  });
  return taskSseReadyPromise;
};
