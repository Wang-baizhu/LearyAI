// projectRenameApi.test.ts 负责验证项目重命名接口的请求参数与响应映射。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiRequest: mocks.apiRequest }));

import { projectRenameApi } from '../projectRenameApi';

describe('projectRenameApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('rename 会发送 PATCH 请求并映射项目实体', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        projectId: 'project-1',
        name: '新名字',
      },
      message: '已更新',
    });

    await expect(projectRenameApi.rename('project-1', { name: '新名字' })).resolves.toEqual({
      item: {
        projectId: 'project-1',
        name: '新名字',
        role: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      },
      message: '已更新',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/projects/project-1', {
      method: 'PATCH',
      body: { name: '新名字' },
    });
  });
});
