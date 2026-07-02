// useKnowledgeBaseList.test.ts 负责验证知识库列表 hook 的 query 配置。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useQuery: vi.fn((options) => options),
  fetchList: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: mocks.useQuery,
}));

vi.mock('../../../api/knowledgeBaseListApi', () => ({
  knowledgeBaseListApi: {
    fetchList: mocks.fetchList,
  },
}));

import { useKnowledgeBaseList } from '../../useKnowledgeBaseList';

describe('useKnowledgeBaseList', () => {
  beforeEach(() => {
    mocks.useQuery.mockReset();
    mocks.useQuery.mockImplementation((options) => options);
    mocks.fetchList.mockReset();
  });

  it('会构造包含筛选参数的 queryKey，并在缺少 projectId 时禁用查询', async () => {
    mocks.fetchList.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });

    useKnowledgeBaseList({
      projectId: '',
      search: '架构',
      tag: '后端',
      sort: 'updatedAt',
      order: 'desc',
      page: 2,
      size: 10,
    });
    const queryOptions = mocks.useQuery.mock.calls[0][0];

    expect(queryOptions.queryKey).toEqual([
      'knowledge-base',
      'list',
      '',
      '架构',
      '后端',
      'updatedAt',
      'desc',
      2,
      10,
    ]);
    expect(queryOptions.enabled).toBe(false);
    await expect(queryOptions.queryFn()).resolves.toEqual({
      items: [],
      total: 0,
      page: 1,
      size: 20,
    });
    expect(mocks.fetchList).toHaveBeenCalledWith({
      projectId: '',
      search: '架构',
      tag: '后端',
      sort: 'updatedAt',
      order: 'desc',
      page: 2,
      size: 10,
    });
  });
});
