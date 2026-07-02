// useProjects.test.ts 负责验证项目列表 hook 的查询配置。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn((options) => options),
  fetchList: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('../../../api/projectListApi', () => ({
  projectListApi: {
    fetchList: mocks.fetchList,
  },
}));

import { useProjects } from '../../useProjects';

describe('useProjects', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useQuery.mockImplementation((options) => options);
    mocks.fetchList.mockReset();
  });

  it('会生成稳定 queryKey，并把查询函数委托给 projectListApi', async () => {
    mocks.fetchList.mockResolvedValue([{ projectId: 'p-1', name: '项目 A' }]);

    useProjects(2, 50, false);
    const queryOptions = mocks.useQuery.mock.calls[0][0];

    expect(queryOptions.queryKey).toEqual(['projects', 'list', 2, 50]);
    expect(queryOptions.enabled).toBe(false);
    await expect(queryOptions.queryFn()).resolves.toEqual([{ projectId: 'p-1', name: '项目 A' }]);
    expect(mocks.fetchList).toHaveBeenCalledWith(2, 50);
  });
});
