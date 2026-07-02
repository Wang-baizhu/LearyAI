// useDeleteProject.test.ts 负责验证项目删除 hook 的配置与缓存刷新行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const invalidateQueries = vi.fn();
  return {
    invalidateQueries,
    useMutation: vi.fn((options) => options),
    useQueryClient: vi.fn(() => ({
      invalidateQueries,
    })),
    remove: vi.fn(),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/projectDeleteApi', () => ({
  projectDeleteApi: {
    remove: mocks.remove,
  },
}));

import { useDeleteProject } from '../../useDeleteProject';

describe('useDeleteProject', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockClear();
    mocks.useQueryClient.mockClear();
    mocks.remove.mockReset();
  });

  it('会把 mutationFn 委托给 projectDeleteApi.remove', async () => {
    mocks.remove.mockResolvedValue(undefined);

    useDeleteProject();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(mutationOptions.mutationFn({ projectId: 'project-1' })).resolves.toBeUndefined();
    expect(mocks.remove).toHaveBeenCalledWith('project-1');
  });

  it('删除成功后会刷新 list 与 recent 缓存', () => {
    useDeleteProject();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    mutationOptions.onSuccess?.(undefined, { projectId: 'project-1' });

    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['visits', 'recent'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['projects', 'list'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['projects', 'recent'],
    });
  });
});
