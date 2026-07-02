// useProjectMemberHooks.test.ts 负责验证项目成员查询与 mutation hook 的配置和缓存刷新行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
  useQueryClient: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}));

import { projectMemberApi } from '../../../api/projectMemberApi';
import { useLeaveProject } from '../useLeaveProject';
import { useProjectMembers } from '../useProjectMembers';
import { useRemoveProjectMember } from '../useRemoveProjectMember';
import { useTransferProjectOwner } from '../useTransferProjectOwner';
import { useUpdateProjectMemberRole } from '../useUpdateProjectMemberRole';

describe('project member hooks', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQuery.mockReset();
    mocks.useQuery.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
  });

  it('useProjectMembers 会生成稳定 queryKey，并把查询委托给 projectMemberApi.fetchList', async () => {
    const expected = { items: [], total: 0, page: 2, size: 10 };
    const fetchListSpy = vi.spyOn(projectMemberApi, 'fetchList').mockResolvedValue(expected);

    useProjectMembers('project-1', 2, 10);
    const queryOptions = mocks.useQuery.mock.calls[0][0];

    expect(queryOptions.queryKey).toEqual(['project', 'members', 'project-1', 2, 10]);
    expect(queryOptions.enabled).toBe(true);
    await expect(queryOptions.queryFn()).resolves.toEqual(expected);
    expect(fetchListSpy).toHaveBeenCalledWith('project-1', 2, 10);
  });

  it('useProjectMembers 会在缺少 projectId 时禁用查询', () => {
    useProjectMembers('', 1, 20);
    const queryOptions = mocks.useQuery.mock.calls[0][0];
    expect(queryOptions.enabled).toBe(false);
  });

  it('useLeaveProject 成功后会刷新成员与项目列表缓存', async () => {
    const leaveProjectSpy = vi.spyOn(projectMemberApi, 'leaveProject').mockResolvedValue(undefined);

    useLeaveProject();
    const leaveMutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(leaveMutationOptions.mutationFn({ projectId: 'project-1' })).resolves.toBeUndefined();
    leaveMutationOptions.onSuccess?.(undefined, { projectId: 'project-1' });

    expect(leaveProjectSpy).toHaveBeenCalledWith('project-1');
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['project', 'members', 'project-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['projects', 'list'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['projects', 'recent'],
    });
  });

  it('useRemoveProjectMember 与 useUpdateProjectMemberRole 成功后会刷新成员缓存', async () => {
    const removeMemberSpy = vi.spyOn(projectMemberApi, 'removeMember').mockResolvedValue(undefined);
    const updateMemberRoleSpy = vi
      .spyOn(projectMemberApi, 'updateMemberRole')
      .mockResolvedValue(undefined);

    useRemoveProjectMember();
    const removeMutationOptions = mocks.useMutation.mock.calls[0][0];
    await expect(
      removeMutationOptions.mutationFn({ projectId: 'project-1', userId: 2 })
    ).resolves.toBeUndefined();
    removeMutationOptions.onSuccess?.(undefined, { projectId: 'project-1', userId: 2 });

    useUpdateProjectMemberRole();
    const updateMutationOptions = mocks.useMutation.mock.calls[1][0];
    await expect(
      updateMutationOptions.mutationFn({ projectId: 'project-1', userId: 2, role: 'ADMIN' })
    ).resolves.toBeUndefined();
    updateMutationOptions.onSuccess?.(undefined, { projectId: 'project-1', userId: 2, role: 'ADMIN' });

    expect(removeMemberSpy).toHaveBeenCalledWith('project-1', 2);
    expect(updateMemberRoleSpy).toHaveBeenCalledWith('project-1', 2, 'ADMIN');
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['project', 'members', 'project-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['project', 'members', 'project-1'],
    });
  });

  it('useTransferProjectOwner 成功后会刷新成员与项目列表缓存', async () => {
    const transferOwnerSpy = vi
      .spyOn(projectMemberApi, 'transferOwner')
      .mockResolvedValue(undefined);

    useTransferProjectOwner();
    const mutationOptions = mocks.useMutation.mock.calls[0][0];

    await expect(
      mutationOptions.mutationFn({ projectId: 'project-1', targetUserId: 3 })
    ).resolves.toBeUndefined();
    mutationOptions.onSuccess?.(undefined, { projectId: 'project-1', targetUserId: 3 });

    expect(transferOwnerSpy).toHaveBeenCalledWith('project-1', 3);
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(1, {
      queryKey: ['project', 'members', 'project-1'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(2, {
      queryKey: ['projects', 'list'],
    });
    expect(mocks.invalidateQueries).toHaveBeenNthCalledWith(3, {
      queryKey: ['projects', 'recent'],
    });
  });
});
