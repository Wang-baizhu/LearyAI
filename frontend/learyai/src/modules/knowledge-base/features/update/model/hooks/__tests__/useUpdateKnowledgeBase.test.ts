// useUpdateKnowledgeBase.test.ts 负责验证更新知识库 hook 的 mutation 配置与缓存刷新行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/knowledgeBaseUpdateApi', () => ({
  knowledgeBaseUpdateApi: {
    update: mocks.update,
  },
}));

import { useUpdateKnowledgeBase } from '../../useUpdateKnowledgeBase';

describe('useUpdateKnowledgeBase', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
    mocks.update.mockReset();
  });

  it('会委托 update API，并在成功后刷新 recent/list 缓存', async () => {
    const result = {
      item: {
        kbId: 'kb-1',
        name: '新名称',
      },
      message: 'ok',
    };
    mocks.update.mockResolvedValue(result);

    useUpdateKnowledgeBase();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(
      mutationOptions.mutationFn({
        kbId: 'kb-1',
        projectId: 'project-1',
        payload: { name: '新名称' },
      })
    ).resolves.toEqual(result);
    expect(mocks.update).toHaveBeenCalledWith('kb-1', { name: '新名称' }, 'project-1');

    mutationOptions.onSuccess?.(result as never, {
      kbId: 'kb-1',
      projectId: 'project-1',
      payload: { name: '新名称' },
    });

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
