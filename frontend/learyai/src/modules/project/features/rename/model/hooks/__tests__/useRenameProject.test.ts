// useRenameProject.test.ts 负责验证项目重命名 hook 的 mutation 配置与缓存刷新。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  rename: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/projectRenameApi', () => ({
  projectRenameApi: { rename: mocks.rename },
}));

import { useRenameProject } from '../../useRenameProject';

describe('useRenameProject', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
    mocks.rename.mockReset();
  });

  it('会调用重命名接口并刷新项目缓存', async () => {
    mocks.rename.mockResolvedValue({ item: { projectId: 'project-1' }, message: 'ok' });
    useRenameProject();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(
      mutationOptions.mutationFn({ projectId: 'project-1', payload: { name: '新名字' } })
    ).resolves.toEqual({ item: { projectId: 'project-1' }, message: 'ok' });
    expect(mocks.rename).toHaveBeenCalledWith('project-1', { name: '新名字' });

    mutationOptions.onSuccess?.();
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['visits', 'recent'] });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['projects', 'list'] });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, { queryKey: ['projects', 'recent'] });
  });
});
