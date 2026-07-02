// query.test.ts 负责验证任务列表 hook 的 queryKey、queryFn 与 enabled 条件。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useInfiniteQuery: vi.fn((options) => options),
  getTaskList: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: mocks.useInfiniteQuery,
}));

vi.mock('../../effects/api', () => ({
  taskApi: { getTaskList: mocks.getTaskList },
}));

import { useTaskList } from '../query';

describe('useTaskList', () => {
  beforeEach(() => {
    mocks.useInfiniteQuery.mockReset();
    mocks.useInfiniteQuery.mockImplementation((options) => options);
    mocks.getTaskList.mockReset();
  });

  it('会暴露按作用域查询的配置，并在 projectId/kbId 缺失时禁用查询', async () => {
    useTaskList({ projectId: 'project-1', kbId: 'kb-1', size: 20 });
    const queryOptions = mocks.useInfiniteQuery.mock.calls[0][0];

    expect(queryOptions.queryKey).toEqual(['task', 'list', { projectId: 'project-1', kbId: 'kb-1', size: 20 }]);
    expect(queryOptions.initialPageParam).toBe(1);
    expect(queryOptions.enabled).toBe(true);
    await queryOptions.queryFn({ pageParam: 3 });
    expect(mocks.getTaskList).toHaveBeenCalledWith({ projectId: 'project-1', kbId: 'kb-1', size: 20, page: 3 });
    expect(queryOptions.getNextPageParam({ page: 2, size: 20, total: 45 })).toBe(3);
    expect(queryOptions.getNextPageParam({ page: 3, size: 20, total: 45 })).toBeUndefined();

    useTaskList({ projectId: 'project-1' } as never);
    const disabledQueryOptions = mocks.useInfiniteQuery.mock.calls[1][0];
    expect(disabledQueryOptions.enabled).toBe(false);
  });
});
