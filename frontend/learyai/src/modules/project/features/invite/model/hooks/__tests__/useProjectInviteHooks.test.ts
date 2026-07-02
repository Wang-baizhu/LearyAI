// useProjectInviteHooks.test.ts 负责验证项目邀请相关 mutation hook 的委托与缓存刷新行为。
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

  it('useAcceptProjectInvite 会委托 acceptInvite 并在成功后刷新项目缓存', async () => {
    mocks.acceptInvite.mockResolvedValue(undefined);

    useAcceptProjectInvite();
    const acceptMutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(acceptMutationOptions.mutationFn({ inviteCode: 'ABC123' })).resolves.toBeUndefined();
    expect(mocks.acceptInvite).toHaveBeenCalledWith({ inviteCode: 'ABC123' });

    acceptMutationOptions.onSuccess?.(undefined, { inviteCode: 'ABC123' });

    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['projects', 'list'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['projects', 'recent'],
    });
  });

  it('useCreateProjectInvite 会把 mutationFn 委托给 createInvite', async () => {
    const result = { id: 1, code: 'invite', status: 'ACTIVE', expiresAt: '2026-04-01T00:00:00.000Z' };
    mocks.createInvite.mockResolvedValue(result);

    useCreateProjectInvite();
    const createMutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(
      createMutationOptions.mutationFn({
        projectId: 'project-1',
        maxUse: 2,
        expiresAt: '2026-04-01T00:00:00.000Z',
      })
    ).resolves.toEqual(result);
  });
});
