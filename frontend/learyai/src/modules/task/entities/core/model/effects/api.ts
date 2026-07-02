// api 负责通用任务列表接口封装，并基于 backend generated contract 约束请求与响应类型。
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiQuery, ApiReq, ApiRes } from '@/shared/api/contract';
import { refetchActiveTaskList } from '@/shared/query/taskListRefetch';
import type {
  RetryFailedTaskRequest,
  TaskCreateRequest,
  TaskDetailResponse,
  TaskListParams,
  TaskListResponse,
} from '../types';
import { ensureTaskSseConnected, closeTaskSse, ensureTaskSseReady } from './taskSse';
import { hasInProgressTask, joinParam } from './api.helpers';

type TaskListApiQuery = Partial<ApiQuery<'/api/tasks', 'get'>>;
type TaskListApiData = NonNullable<ApiRes<'/api/tasks', 'get'>['data']>;
type TaskListApiEnvelope = ApiEnvelope<TaskListApiData>;
type CreateTaskApiBody = ApiReq<'/api/tasks', 'post'>;
type CreateTaskApiData = NonNullable<ApiRes<'/api/tasks', 'post'>['data']>;
type CreateTaskApiEnvelope = ApiEnvelope<CreateTaskApiData>;
type RetryTaskApiBody = ApiReq<'/api/tasks/{taskId}/retry', 'post'>;
type RetryTaskApiData = NonNullable<ApiRes<'/api/tasks/{taskId}/retry', 'post'>['data']>;
type RetryTaskApiEnvelope = ApiEnvelope<RetryTaskApiData>;

const unwrapResponse = <T>(response: ApiEnvelope<T>) => response.data;

export const taskApi = {
  getTaskList: async (params: TaskListParams = {}): Promise<TaskListResponse> => {
    const query: TaskListApiQuery = {
      projectId: params.projectId,
      kbId: params.kbId,
      types: joinParam(params.types),
      statuses: joinParam(params.statuses),
      page: params.page,
      size: params.size,
    };
    const response = await apiRequest<TaskListApiEnvelope>('/tasks', {
      params: query,
    });
    const data = unwrapResponse(response) as TaskListResponse;
    if (hasInProgressTask(data)) {
      try {
        ensureTaskSseConnected(params.projectId, params.kbId);
      } catch (error) {
        console.warn('[TaskSSE] init failed', error);
      }
    } else {
      closeTaskSse(params.projectId, params.kbId);
    }
    return data;
  },
  createTask: async (payload: TaskCreateRequest): Promise<TaskDetailResponse> => {
    const kbId = payload.kbId?.trim();
    if (!kbId) {
      throw new Error('缺少 kbId，无法创建任务');
    }
    try {
      await ensureTaskSseReady(payload.projectId, kbId.trim(), 10000);
    } catch (error) {
      console.warn('[TaskSSE] init failed', error);
      throw new Error('SSE 连接失败，请稍后重试');
    }
    const body = {
      ...payload,
      kbId,
      pipelineContext: payload.pipelineContext,
    } as unknown as CreateTaskApiBody;
    const response = await apiRequest<CreateTaskApiEnvelope>('/tasks', {
      method: 'POST',
      body,
    });
    void refetchActiveTaskList(payload.projectId, kbId);
    return unwrapResponse(response) as TaskDetailResponse;
  },
  retryFailedTask: async (payload: RetryFailedTaskRequest): Promise<boolean> => {
    try {
      await ensureTaskSseReady(payload.projectId, payload.kbId, 10000);
    } catch (error) {
      console.warn('[TaskSSE] re-init failed', error);
      throw new Error('SSE 连接失败，请稍后重试');
    }
    const body = {
      projectId: payload.projectId,
      kbId: payload.kbId,
    } satisfies RetryTaskApiBody;
    const response = await apiRequest<RetryTaskApiEnvelope>(`/tasks/${payload.taskId}/retry`, {
      method: 'POST',
      body,
    });
    void refetchActiveTaskList(payload.projectId, payload.kbId);
    return unwrapResponse(response);
  },
};
