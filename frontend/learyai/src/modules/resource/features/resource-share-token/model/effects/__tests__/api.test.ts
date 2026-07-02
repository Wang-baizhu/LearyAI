// api.test.ts 负责验证分享 token 接口的请求体和响应归一化行为。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

import { resourceShareTokenApi } from '../api';

describe('resourceShareTokenApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('createToken 会发送标准契约请求并归一化响应', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        token: 'token-1',
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [
          { id: 'doc-1', name: '文档一' },
          { id: 'doc-2', name: '文档二' },
        ],
        abilities: ['search'],
        expiresAt: '2026-05-06T12:00:00Z',
      },
    });

    await expect(
      resourceShareTokenApi.createToken({
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [{ id: 'doc-1', name: '文档一' }],
        expiresInDays: 1,
      })
    ).resolves.toEqual({
      token: 'token-1',
      projectId: 'project-1',
      kbId: 'kb-1',
      docRefs: [
        { id: 'doc-1', name: '文档一' },
        { id: 'doc-2', name: '文档二' },
      ],
      abilities: ['search'],
      expiresAt: '2026-05-06T12:00:00Z',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/skills/kb/token', {
      method: 'POST',
      body: {
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [{ id: 'doc-1', name: '文档一' }],
        abilities: ['search'],
        expiresInDays: 1,
        neverExpires: undefined,
      },
    });
  });

  it('createToken 支持永久不过期参数', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        token: 'token-2',
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [],
        abilities: ['search'],
        expiresAt: null,
      },
    });

    await expect(
      resourceShareTokenApi.createToken({
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [{ id: 'doc-1', name: '文档一' }],
        neverExpires: true,
      })
    ).resolves.toEqual({
      token: 'token-2',
      projectId: 'project-1',
      kbId: 'kb-1',
      docRefs: [],
      abilities: ['search'],
      expiresAt: null,
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/skills/kb/token', {
      method: 'POST',
      body: {
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [{ id: 'doc-1', name: '文档一' }],
        abilities: ['search'],
        expiresInDays: undefined,
        neverExpires: true,
      },
    });
  });

  it('createToken 在响应缺少核心字段时会抛错', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        token: '',
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [],
        abilities: ['search'],
      },
    });

    await expect(
      resourceShareTokenApi.createToken({
        projectId: 'project-1',
        kbId: 'kb-1',
        docRefs: [{ id: 'doc-1', name: '文档一' }],
      })
    ).rejects.toThrow('分享 token 响应不完整，请稍后重试。');
  });
});
