// projectCreateApi.test.ts 负责验证项目创建接口的请求参数与响应映射。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiRequest: mocks.apiRequest }));

import { projectCreateApi } from '../projectCreateApi';

describe('projectCreateApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('create 会发送 POST 请求并映射项目实体', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        projectId: 'project-1',
        name: 'LearyAI',
        role: 'OWNER',
      },
      message: '创建成功',
    });

    await expect(projectCreateApi.create({ name: 'LearyAI' })).resolves.toEqual({
      item: {
        projectId: 'project-1',
        name: 'LearyAI',
        role: 'OWNER',
        createdAt: undefined,
        updatedAt: undefined,
      },
      message: '创建成功',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/projects', {
      method: 'POST',
      body: { name: 'LearyAI' },
    });
  });
});
