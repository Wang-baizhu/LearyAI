// taskSse.test.ts 负责验证任务 SSE 连接建立、就绪等待与 task-status 事件分支处理。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskListResponse } from '../../types';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  enqueueToast: vi.fn((payload) => ({
    type: 'toast/enqueue',
    payload,
  })),
  getQueriesData: vi.fn(),
  refetchQueries: vi.fn(),
}));

vi.mock('@/shared/query/queryClient', () => ({
  queryClient: {
    getQueriesData: mocks.getQueriesData,
    refetchQueries: mocks.refetchQueries,
  },
}));

vi.mock('@/app/store', () => ({
  store: {
    dispatch: mocks.dispatch,
  },
}));

vi.mock('@/app/store/ui/toastSlice', () => ({
  enqueueToast: mocks.enqueueToast,
}));

class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;
  static instances: MockEventSource[] = [];

  readonly url: string;
  readonly withCredentials: boolean;
  readyState = MockEventSource.CONNECTING;
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string, options?: { withCredentials?: boolean }) {
    this.url = url;
    this.withCredentials = Boolean(options?.withCredentials);
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set<(event: MessageEvent) => void>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  close() {
    this.readyState = MockEventSource.CLOSED;
  }

  emit(type: string, event: Partial<MessageEvent> & { data?: string } = {}) {
    const payload = {
      data: '',
      lastEventId: '',
      ...event,
    } as MessageEvent;
    this.listeners.get(type)?.forEach((listener) => listener(payload));
  }
}

const setTaskQueryData = (items: TaskListResponse['items']) => {
  mocks.getQueriesData.mockReturnValue([
    [
      ['task', 'list', { projectId: 'project-1', kbId: 'kb-1' }],
      {
        items,
        total: items.length,
        page: 1,
        size: 20,
      } satisfies TaskListResponse,
    ],
  ]);
};

const loadTaskSse = async () => {
  vi.resetModules();
  return import('../taskSse');
};

describe('taskSse', () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    mocks.dispatch.mockReset();
    mocks.enqueueToast.mockClear();
    mocks.getQueriesData.mockReset();
    mocks.refetchQueries.mockReset();
    vi.unstubAllEnvs();
    vi.useRealTimers();
    Object.assign(globalThis, {
      EventSource: MockEventSource,
      window: globalThis,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ensureTaskSseConnected 会校验作用域、裁剪 /api 基础地址并复用同作用域连接', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.com/api/');
    const { closeTaskSse, ensureTaskSseConnected } = await loadTaskSse();

    expect(() => ensureTaskSseConnected(undefined, 'kb-1')).toThrow('缺少 projectId，无法建立任务 SSE 连接');
    expect(() => ensureTaskSseConnected('project-1', undefined)).toThrow('缺少 kbId，无法建立任务 SSE 连接');

    ensureTaskSseConnected('project-1', 'kb-1');

    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.instances[0]?.url).toBe(
      'https://api.example.com/sse/tasks?projectId=project-1&kbId=kb-1'
    );
    expect(MockEventSource.instances[0]?.withCredentials).toBe(true);

    ensureTaskSseConnected('project-1', 'kb-1');
    expect(MockEventSource.instances).toHaveLength(1);

    closeTaskSse('project-2', 'kb-1');
    expect(MockEventSource.instances[0]?.readyState).toBe(MockEventSource.CONNECTING);

    closeTaskSse('project-1', 'kb-1');
    expect(MockEventSource.instances[0]?.readyState).toBe(MockEventSource.CLOSED);
  }, 10000);

  it('ensureTaskSseReady 会在 open 事件后 resolve，并在超时后 reject', async () => {
    vi.useFakeTimers();
    const { ensureTaskSseReady } = await loadTaskSse();

    const readyPromise = ensureTaskSseReady('project-1', 'kb-1', 20);
    const source = MockEventSource.instances[0];

    source.readyState = MockEventSource.OPEN;
    source.emit('open');
    await expect(readyPromise).resolves.toBeUndefined();

    source.readyState = MockEventSource.CONNECTING;
    const timeoutPromise = ensureTaskSseReady('project-1', 'kb-1', 20);
    vi.advanceTimersByTime(20);
    await expect(timeoutPromise).rejects.toThrow('SSE 连接超时');
  }, 10000);

  it('error 事件在连接已关闭时会清理旧连接，后续可重新创建', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { ensureTaskSseConnected } = await loadTaskSse();

    ensureTaskSseConnected('project-1', 'kb-1');
    const source = MockEventSource.instances[0];

    source.readyState = MockEventSource.CLOSED;
    source.emit('error');

    ensureTaskSseConnected('project-1', 'kb-1');

    expect(warnSpy).toHaveBeenCalledWith('[TaskSSE] error', { readyState: MockEventSource.CLOSED });
    expect(MockEventSource.instances).toHaveLength(2);
    warnSpy.mockRestore();
  });

  it('FAILED 事件会刷新任务列表、派发失败 toast，并在无进行中任务时关闭连接', async () => {
    const { ensureTaskSseConnected } = await loadTaskSse();
    setTaskQueryData([
      {
        taskId: 'task-1',
        type: 'document_pipeline',
        typeId: 'type-1',
        status: 'DONE',
        createdAt: '2026-03-29T00:00:00.000Z',
        updatedAt: '2026-03-29T00:00:00.000Z',
      },
    ]);

    ensureTaskSseConnected('project-1', 'kb-1');
    const source = MockEventSource.instances[0];

    const payload = JSON.stringify({
      taskId: 'task-1',
      projectId: 'project-1',
      kbId: 'kb-1',
      pipelineType: 'document_pipeline',
      status: 'FAILED',
      viewData: {
        failedReason: '解析失败',
      },
    });

    source.emit('task-status', { data: payload });
    source.emit('task-status', { data: payload });

    expect(mocks.refetchQueries).toHaveBeenCalledTimes(2);
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    expect(mocks.enqueueToast).toHaveBeenCalledWith({
      variant: 'error',
      message: '文档任务处理失败：解析失败',
      durationMs: 8000,
    });
    expect(source.readyState).toBe(MockEventSource.CLOSED);
  });

  it('DONE 模板任务会刷新资源中心匹配插件的模板第一页列表与筛选项', async () => {
    const { ensureTaskSseConnected } = await loadTaskSse();
    setTaskQueryData([]);

    ensureTaskSseConnected('project-1', 'kb-1');
    const source = MockEventSource.instances[0];

    source.emit('task-status', {
      data: JSON.stringify({
        taskId: 'task-2',
        projectId: 'project-1',
        kbId: 'kb-1',
        pipelineType: 'template_pipeline',
        status: 'DONE',
        currentStage: 'agent:template:plugin-mindmap',
      }),
    });

    expect(mocks.refetchQueries).toHaveBeenCalledTimes(3);

    const taskPredicate = mocks.refetchQueries.mock.calls[0]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;
    const templateListPredicate = mocks.refetchQueries.mock.calls[1]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;
    const templateFacetsPredicate = mocks.refetchQueries.mock.calls[2]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;

    expect(
      taskPredicate({
        queryKey: ['task', 'list', { projectId: 'project-1', kbId: 'kb-1' }],
      })
    ).toBe(true);
    expect(
      templateListPredicate({
        queryKey: ['resource-center', 'template-list', 'project-1', 'kb-1', 'plugin-mindmap', 'plugin-mindmap', '', null, null, 1, 20],
      })
    ).toBe(true);
    expect(
      templateListPredicate({
        queryKey: ['resource-center', 'template-list', 'project-1', 'kb-1', 'all', 'plugin-mindmap', '', null, null, 1, 20],
      })
    ).toBe(true);
    expect(
      templateListPredicate({
        queryKey: ['resource-center', 'template-list', 'project-1', 'kb-1', 'plugin-mindmap', 'plugin-mindmap', '', null, null, 2, 20],
      })
    ).toBe(false);
    expect(
      templateListPredicate({
        queryKey: ['resource-center', 'template-list', 'project-1', 'kb-1', 'plugin-quiz', 'plugin-quiz', '', null, null, 1, 20],
      })
    ).toBe(false);
    expect(
      templateFacetsPredicate({
        queryKey: ['resource-center', 'template-facets', 'project-1', 'kb-1', 'plugin-mindmap', 'plugin-mindmap', ''],
      })
    ).toBe(true);
    expect(
      templateFacetsPredicate({
        queryKey: ['resource-center', 'template-facets', 'project-1', 'kb-1', 'all', 'plugin-mindmap', ''],
      })
    ).toBe(false);
  });

  it('DONE card 模板任务会只刷新 card 对应资源中心模板缓存', async () => {
    const { ensureTaskSseConnected } = await loadTaskSse();
    setTaskQueryData([]);

    ensureTaskSseConnected('project-1', 'kb-1');
    const source = MockEventSource.instances[0];

    source.emit('task-status', {
      data: JSON.stringify({
        taskId: 'task-4',
        projectId: 'project-1',
        kbId: 'kb-1',
        pipelineType: 'template_pipeline',
        status: 'DONE',
        currentStage: 'agent:template:plugin-card',
      }),
    });

    expect(mocks.refetchQueries).toHaveBeenCalledTimes(3);

    const templatePredicate = mocks.refetchQueries.mock.calls[1]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;

    expect(
      templatePredicate({
        queryKey: ['resource-center', 'template-list', 'project-1', 'kb-1', 'plugin-card', 'plugin-card', '', null, null, 1, 20],
      })
    ).toBe(true);
    expect(
      templatePredicate({
        queryKey: ['resource-center', 'template-list', 'project-1', 'kb-1', 'plugin-card', 'plugin-card', '', null, null, 2, 20],
      })
    ).toBe(false);
    expect(
      templatePredicate({
        queryKey: ['resource-center', 'template-list', 'project-1', 'kb-1', 'plugin-quiz', 'plugin-quiz', '', null, null, 1, 20],
      })
    ).toBe(false);
  });

  it('DONE 文档任务会刷新资源列表、options、聚合页与 recent', async () => {
    const { ensureTaskSseConnected } = await loadTaskSse();
    setTaskQueryData([]);

    ensureTaskSseConnected('project-1', 'kb-1');
    const source = MockEventSource.instances[0];

    source.emit('task-status', {
      data: JSON.stringify({
        taskId: 'task-3',
        projectId: 'project-1',
        kbId: 'kb-1',
        pipelineType: 'document_pipeline',
        status: 'DONE',
        currentStage: 'doc:main',
      }),
    });

    expect(mocks.refetchQueries).toHaveBeenCalledTimes(5);

    const listPredicate = mocks.refetchQueries.mock.calls[1]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;
    const optionsPredicate = mocks.refetchQueries.mock.calls[2]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;
    const aggregatedPredicate = mocks.refetchQueries.mock.calls[3]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;
    const recentPredicate = mocks.refetchQueries.mock.calls[4]?.[0]?.predicate as (query: {
      queryKey: unknown[];
    }) => boolean;

    expect(
      listPredicate({
        queryKey: ['resource', 'list', { projectId: 'project-1', kbId: 'kb-1', page: 1 }],
      })
    ).toBe(true);
    expect(
      listPredicate({
        queryKey: ['resource', 'list', { projectId: 'project-1', kbId: 'kb-1', page: 2 }],
      })
    ).toBe(false);

    expect(
      optionsPredicate({
        queryKey: ['resource', 'options', { projectId: 'project-1', kbId: 'kb-1' }],
      })
    ).toBe(true);
    expect(
      aggregatedPredicate({
        queryKey: ['resource', 'aggregated', 'all', { projectId: 'project-1', kbId: 'kb-1', page: 1 }],
      })
    ).toBe(true);
    expect(
      aggregatedPredicate({
        queryKey: ['resource', 'aggregated', 'all', { projectId: 'project-1', kbId: 'kb-1', page: 3 }],
      })
    ).toBe(false);

    expect(
      recentPredicate({
        queryKey: ['resource', 'recent', 'project-1'],
      })
    ).toBe(true);
    expect(
      recentPredicate({
        queryKey: ['resource', 'recent', 'project-2'],
      })
    ).toBe(false);
  });
});
