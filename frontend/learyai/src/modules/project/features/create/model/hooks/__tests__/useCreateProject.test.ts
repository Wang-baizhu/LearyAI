// useCreateProject.test.ts 负责验证项目创建 hook 的配置与缓存刷新行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  create: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/projectCreateApi', () => ({
  projectCreateApi: {
    create: mocks.create,
  },
}));

import { useCreateProject } from '../../useCreateProject';

describe('useCreateProject', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
    mocks.create.mockReset();
  });

  it('会通过 useMutation 暴露创建项目所需的配置项，并在成功后刷新缓存', () => {
    useCreateProject();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];
    expect(mutationOptions.mutationFn).toBeTypeOf('function');
    expect(mocks.useMutation).toHaveBeenCalledTimes(1);

    mutationOptions.onSuccess?.(
      {
        item: {
          projectId: 'project-1',
          name: 'LearyAI',
        },
        message: 'ok',
      },
      { name: 'LearyAI' }
    );

    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['visits', 'recent'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['projects', 'recent'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['projects', 'list'],
    });
  });
});
