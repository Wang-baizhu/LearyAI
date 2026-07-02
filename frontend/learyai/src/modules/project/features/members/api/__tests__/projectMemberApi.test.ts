// projectMemberApi.test.ts 负责验证项目成员接口的查询参数、映射与操作请求。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiRequest: mocks.apiRequest }));

import { projectMemberApi } from '../projectMemberApi';

describe('projectMemberApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('fetchList 会透传分页参数并把空名字映射为 null', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        items: [{ userId: 1, name: undefined, role: 'ADMIN', status: 'ACTIVE' }],
        total: 1,
        page: 2,
        size: 50,
      },
    });

    await expect(projectMemberApi.fetchList('project-1', 2, 50)).resolves.toEqual({
      items: [{ userId: 1, name: null, role: 'ADMIN', status: 'ACTIVE', createdAt: null }],
      total: 1,
      page: 2,
      size: 50,
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/projects/project-1/members', {
      params: { page: 2, size: 50 },
    });
  });

  it('成员操作接口会发送对应请求', async () => {
    mocks.apiRequest.mockResolvedValue(undefined);

    await projectMemberApi.removeMember('project-1', 1);
    await projectMemberApi.updateMemberRole('project-1', 2, 'MEMBER');
    await projectMemberApi.leaveProject('project-1');
    await projectMemberApi.transferOwner('project-1', 3);

    expect(mocks.apiRequest).toHaveBeenNthCalledWith(1, '/projects/project-1/members/1', {
      method: 'DELETE',
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(2, '/projects/project-1/members/2/role', {
      method: 'PATCH',
      body: { role: 'MEMBER' },
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(3, '/projects/project-1/leave', {
      method: 'POST',
    });
    expect(mocks.apiRequest).toHaveBeenNthCalledWith(4, '/projects/project-1/transfer', {
      method: 'POST',
      body: { targetUserId: 3 },
    });
  });
});
