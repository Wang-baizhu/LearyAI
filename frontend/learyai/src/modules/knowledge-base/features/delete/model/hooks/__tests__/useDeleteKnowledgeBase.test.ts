// useDeleteKnowledgeBase.test.ts 负责验证删除知识库 hook 的 mutation 配置与缓存刷新行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/knowledgeBaseDeleteApi', () => ({
  knowledgeBaseDeleteApi: {
    remove: mocks.remove,
  },
}));

import { useDeleteKnowledgeBase } from '../../useDeleteKnowledgeBase';

describe('useDeleteKnowledgeBase', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
    mocks.remove.mockReset();
  });

  it('会委托删除 API，并在成功后刷新 recent/list 缓存', async () => {
    mocks.remove.mockResolvedValue(undefined);

    useDeleteKnowledgeBase();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(
      mutationOptions.mutationFn({
        kbId: 'kb-1',
        projectId: 'project-1',
      })
    ).resolves.toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith('kb-1', 'project-1');

    mutationOptions.onSuccess?.(undefined, { kbId: 'kb-1', projectId: 'project-1' });

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
