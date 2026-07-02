// projectInviteHooks.test.ts 负责验证邀请相关 hooks 的 mutation 配置与缓存刷新。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  acceptInvite: vi.fn(),
  createInvite: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/projectInviteApi', () => ({
  projectInviteApi: {
    acceptInvite: mocks.acceptInvite,
    createInvite: mocks.createInvite,
  },
}));

import { useAcceptProjectInvite } from '../../useAcceptProjectInvite';
import { useCreateProjectInvite } from '../../useCreateProjectInvite';

describe('project invite hooks', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
    mocks.acceptInvite.mockReset();
    mocks.createInvite.mockReset();
  });

  it('useAcceptProjectInvite 会调用接受邀请接口并刷新项目缓存', async () => {
    mocks.acceptInvite.mockResolvedValue(undefined);
    useAcceptProjectInvite();
    const acceptMutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(acceptMutationOptions.mutationFn({ inviteCode: 'ABC' })).resolves.toBeUndefined();
    expect(mocks.acceptInvite).toHaveBeenCalledWith({ inviteCode: 'ABC' });

    acceptMutationOptions.onSuccess?.();
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, { queryKey: ['projects', 'list'] });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, { queryKey: ['projects', 'recent'] });
  });

  it('useCreateProjectInvite 会透传创建邀请码的 mutationFn', async () => {
    mocks.createInvite.mockResolvedValue({ code: 'ABC' });
    useCreateProjectInvite();
    const createMutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(
      createMutationOptions.mutationFn({
        projectId: 'project-1',
        maxUse: 3,
        expiresAt: '2026-01-01T00:00:00Z',
      })
    ).resolves.toEqual({ code: 'ABC' });
    expect(mocks.createInvite).toHaveBeenCalledWith({
      projectId: 'project-1',
      maxUse: 3,
      expiresAt: '2026-01-01T00:00:00Z',
    });
  });
});
