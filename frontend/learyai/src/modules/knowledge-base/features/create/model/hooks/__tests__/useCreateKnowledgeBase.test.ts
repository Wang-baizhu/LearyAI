// useCreateKnowledgeBase.test.ts 负责验证知识库创建 hook 的配置与缓存刷新行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const invalidateQueries = vi.fn();
  return {
    invalidateQueries,
    useMutation: vi.fn((options) => options),
    useQueryClient: vi.fn(() => ({
      invalidateQueries,
    })),
    create: vi.fn(),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/knowledgeBaseCreateApi', () => ({
  knowledgeBaseCreateApi: {
    create: mocks.create,
  },
}));

import { useCreateKnowledgeBase } from '../../useCreateKnowledgeBase';

describe('useCreateKnowledgeBase', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockClear();
    mocks.useQueryClient.mockClear();
    mocks.create.mockReset();
  });

  it('会把创建请求委托给 knowledgeBaseCreateApi.create', async () => {
    mocks.create.mockResolvedValue({
      item: {
        kbId: 'kb-1',
        name: '产品知识库',
        tags: [],
        userId: 1,
        visibility: 'PRIVATE',
      },
      message: 'ok',
    });

    useCreateKnowledgeBase();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];
    const payload = {
      projectId: 'project-1',
      name: '产品知识库',
      description: '用于整理产品资料',
      visibility: 'PRIVATE' as const,
      tags: ['产品'],
    };

    await expect(mutationOptions.mutationFn(payload)).resolves.toEqual({
      item: {
        kbId: 'kb-1',
        name: '产品知识库',
        tags: [],
        userId: 1,
        visibility: 'PRIVATE',
      },
      message: 'ok',
    });
    expect(mocks.create).toHaveBeenCalledWith(payload);
  });

  it('创建成功后会刷新 recent 与 list 缓存', () => {
    useCreateKnowledgeBase();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    mutationOptions.onSuccess?.(
      {
        item: {
          kbId: 'kb-1',
          name: '产品知识库',
          tags: [],
          userId: 1,
          visibility: 'PRIVATE',
        },
        message: 'ok',
      },
      {
        projectId: 'project-1',
        name: '产品知识库',
        description: '',
        visibility: 'PRIVATE',
        tags: [],
      }
    );

    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['visits', 'recent'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['knowledge-base', 'recent', 'project-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['knowledge-base', 'list', 'project-1'],
    });
  });
});
