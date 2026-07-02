// api.test.ts 负责验证任务接口在请求参数、SSE 协调与错误处理上的行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
  ensureTaskSseConnected: vi.fn(),
  closeTaskSse: vi.fn(),
  ensureTaskSseReady: vi.fn(),
  refetchActiveTaskList: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({ apiRequest: mocks.apiRequest }));
vi.mock('@/shared/query/taskListRefetch', () => ({
  refetchActiveTaskList: mocks.refetchActiveTaskList,
}));
vi.mock('../taskSse', () => ({
  ensureTaskSseConnected: mocks.ensureTaskSseConnected,
  closeTaskSse: mocks.closeTaskSse,
  ensureTaskSseReady: mocks.ensureTaskSseReady,
}));

import { taskApi } from '../api';

describe('taskApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
    mocks.ensureTaskSseConnected.mockReset();
    mocks.closeTaskSse.mockReset();
    mocks.ensureTaskSseReady.mockReset();
    mocks.refetchActiveTaskList.mockReset();
  });

  it('getTaskList 在有进行中任务时会尝试建立 SSE，否则关闭当前作用域 SSE', async () => {
    mocks.apiRequest
      .mockResolvedValueOnce({
        data: {
          items: [{ taskId: 'task-1', status: 'PROCESSING', type: 'template_pipeline', typeId: '1', createdAt: '', updatedAt: '' }],
          total: 1,
          page: 1,
          size: 20,
        },
      })
      .mockResolvedValueOnce({
        data: {
          items: [{ taskId: 'task-2', status: 'DONE', type: 'template_pipeline', typeId: '2', createdAt: '', updatedAt: '' }],
          total: 1,
          page: 1,
          size: 20,
        },
      });

    await taskApi.getTaskList({ projectId: 'project-1', kbId: 'kb-1', types: ['template_pipeline'], page: 2, size: 50 });
    await taskApi.getTaskList({ projectId: 'project-1', kbId: 'kb-1' });

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, '/tasks', {
      params: {
        projectId: 'project-1',
        kbId: 'kb-1',
        types: 'template_pipeline',
        statuses: undefined,
        page: 2,
        size: 50,
      },
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, '/tasks', {
      params: {
        projectId: 'project-1',
        kbId: 'kb-1',
        types: undefined,
        statuses: undefined,
        page: undefined,
        size: undefined,
      },
    });
    expect(mocks.ensureTaskSseConnected).toHaveBeenCalledWith('project-1', 'kb-1');
    expect(mocks.closeTaskSse).toHaveBeenCalledWith('project-1', 'kb-1');
  });

  it('createTask 会校验 kbId、等待 SSE 就绪，并原样保留 pipelineContext', async () => {
    mocks.ensureTaskSseReady.mockResolvedValue(undefined);
    mocks.apiRequest.mockResolvedValue({ data: { taskId: 'task-1' } });

    await expect(
      taskApi.createTask({
        projectId: 'project-1',
        kbId: '  kb-1  ',
        type: 'template_pipeline',
        typeId: 'template-1',
        status: 'PROCESSING',
        pipelineContext: {
          foo: 'bar',
          promptVars: {
            focus: '第二章',
          },
        },
      })
    ).resolves.toEqual({ taskId: 'task-1' });

    expect(mocks.ensureTaskSseReady).toHaveBeenCalledWith('project-1', 'kb-1', 10000);
    expect(mocks.apiRequest).toHaveBeenCalledWith('/tasks', {
      method: 'POST',
      body: {
        projectId: 'project-1',
        kbId: 'kb-1',
        type: 'template_pipeline',
        typeId: 'template-1',
        status: 'PROCESSING',
        pipelineContext: {
          foo: 'bar',
          promptVars: {
            focus: '第二章',
          },
        },
      },
    });
    expect(mocks.refetchActiveTaskList).toHaveBeenCalledWith('project-1', 'kb-1');
  });

  it('createTask 在缺少 kbId 或 SSE 初始化失败时会抛错', async () => {
    await expect(taskApi.createTask({ projectId: 'project-1', type: 'template_pipeline', typeId: 'template-1' } as never)).rejects.toThrow(
      '缺少 kbId，无法创建任务'
    );

    mocks.ensureTaskSseReady.mockRejectedValue(new Error('boom'));
    await expect(
      taskApi.createTask({
        projectId: 'project-1',
        kbId: 'kb-1',
        type: 'template_pipeline',
        typeId: 'template-1',
        status: 'PROCESSING',
      })
    ).rejects.toThrow('SSE 连接失败，请稍后重试');
  });

  it('retryFailedTask 会等待 SSE 就绪并发送重试请求', async () => {
    mocks.ensureTaskSseReady.mockResolvedValue(undefined);
    mocks.apiRequest.mockResolvedValue({ data: true });

    await expect(
      taskApi.retryFailedTask({ taskId: 'task-9', projectId: 'project-1', kbId: 'kb-1' })
    ).resolves.toBe(true);

    expect(mocks.ensureTaskSseReady).toHaveBeenCalledWith('project-1', 'kb-1', 10000);
    expect(mocks.apiRequest).toHaveBeenCalledWith('/tasks/task-9/retry', {
      method: 'POST',
      body: { projectId: 'project-1', kbId: 'kb-1' },
    });
    expect(mocks.refetchActiveTaskList).toHaveBeenCalledWith('project-1', 'kb-1');
  });
});
