// projectInviteApi.test.ts 负责验证项目邀请接口的请求参数与返回数据。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiRequest: mocks.apiRequest }));

import { projectInviteApi } from '../projectInviteApi';

describe('projectInviteApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('createInvite 会发送项目级邀请创建请求', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: { id: 1, code: 'ABC', status: 'ACTIVE', expiresAt: '2026-01-01T00:00:00Z' },
    });

    await expect(
      projectInviteApi.createInvite({
        projectId: 'project-1',
        maxUse: 3,
        expiresAt: '2026-01-01T00:00:00Z',
      })
    ).resolves.toEqual({ id: 1, code: 'ABC', status: 'ACTIVE', expiresAt: '2026-01-01T00:00:00Z' });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/projects/project-1/invites', {
      method: 'POST',
      body: { maxUse: 3, expiresAt: '2026-01-01T00:00:00Z' },
    });
  });

  it('acceptInvite 会发送邀请码加入请求', async () => {
    mocks.apiRequest.mockResolvedValue({ data: {} });

    await expect(projectInviteApi.acceptInvite({ inviteCode: 'ABC' })).resolves.toBeUndefined();
    expect(mocks.apiRequest).toHaveBeenCalledWith('/projects/invites/accept', {
      method: 'POST',
      body: { inviteCode: 'ABC' },
    });
  });
});
