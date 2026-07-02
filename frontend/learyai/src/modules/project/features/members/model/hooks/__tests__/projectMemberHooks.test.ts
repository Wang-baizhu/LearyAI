// projectMemberHooks.test.ts 负责验证项目成员 hooks 的查询配置与成功副作用。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  useMutation: vi.fn((options) => options),
  useQuery: vi.fn((options) => options),
  useQueryClient: vi.fn(),
  fetchList: vi.fn(),
  leaveProject: vi.fn(),
  removeMember: vi.fn(),
  transferOwner: vi.fn(),
  updateMemberRole: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useMutation: mocks.useMutation,
  useQuery: mocks.useQuery,
  useQueryClient: mocks.useQueryClient,
}));

vi.mock('../../../api/projectMemberApi', () => ({
  projectMemberApi: {
    fetchList: mocks.fetchList,
    leaveProject: mocks.leaveProject,
    removeMember: mocks.removeMember,
    transferOwner: mocks.transferOwner,
    updateMemberRole: mocks.updateMemberRole,
  },
}));

import { useLeaveProject } from '../useLeaveProject';
import { useProjectMembers } from '../useProjectMembers';
import { useRemoveProjectMember } from '../useRemoveProjectMember';
import { useTransferProjectOwner } from '../useTransferProjectOwner';
import { useUpdateProjectMemberRole } from '../useUpdateProjectMemberRole';

describe('project member hooks', () => {
  beforeEach(() => {
    mocks.invalidateQueries.mockReset();
    mocks.useMutation.mockReset();
    mocks.useMutation.mockImplementation((options) => options);
    mocks.useQuery.mockReset();
    mocks.useQuery.mockImplementation((options) => options);
    mocks.useQueryClient.mockReset();
    mocks.useQueryClient.mockReturnValue({ invalidateQueries: mocks.invalidateQueries });
    mocks.fetchList.mockReset();
    mocks.leaveProject.mockReset();
    mocks.removeMember.mockReset();
    mocks.transferOwner.mockReset();
    mocks.updateMemberRole.mockReset();
  });

  it('useProjectMembers 会暴露分页查询配置', async () => {
    useProjectMembers('project-1', 2, 50);
    const queryOptions = mocks.useQuery.mock.calls[0][0];

    expect(queryOptions.queryKey).toEqual(['project', 'members', 'project-1', 2, 50]);
    expect(queryOptions.enabled).toBe(true);
    await queryOptions.queryFn();
    expect(mocks.fetchList).toHaveBeenCalledWith('project-1', 2, 50);
  });

  it('useLeaveProject / useRemoveProjectMember / useTransferProjectOwner / useUpdateProjectMemberRole 会刷新对应缓存', () => {
    useLeaveProject();
    mocks.useMutation.mock.calls[0][0].onSuccess?.(undefined, { projectId: 'project-1' });

    useRemoveProjectMember();
    mocks.useMutation.mock.calls[1][0].onSuccess?.(undefined, { projectId: 'project-1', userId: 2 });

    useTransferProjectOwner();
    mocks.useMutation.mock.calls[2][0].onSuccess?.(undefined, { projectId: 'project-1', targetUserId: 3 });

    useUpdateProjectMemberRole();
    mocks.useMutation.mock.calls[3][0].onSuccess?.(undefined, {
      projectId: 'project-1',
      userId: 2,
      role: 'ADMIN',
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['project', 'members', 'project-1'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects', 'list'] });
    expect(mocks.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['projects', 'recent'] });
  });
});
