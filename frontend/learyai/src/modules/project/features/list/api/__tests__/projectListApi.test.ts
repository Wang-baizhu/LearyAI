// projectListApi.test.ts 负责验证项目列表接口的分页参数与响应映射。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock('@/shared/api/client', () => ({ apiRequest: mocks.apiRequest }));

import { projectListApi } from '../projectListApi';

describe('projectListApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('fetchList 会拼接分页查询参数并映射项目列表', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        items: [{ projectId: 'project-1', name: 'LearyAI' }],
        total: 1,
        page: 3,
        size: 5,
      },
    });

    await expect(projectListApi.fetchList(3, 5)).resolves.toEqual([
      {
        projectId: 'project-1',
        name: 'LearyAI',
        role: undefined,
        createdAt: undefined,
        updatedAt: undefined,
      },
    ]);

    expect(mocks.apiRequest).toHaveBeenCalledWith('/projects', {
      params: {
        page: 3,
        size: 5,
      },
    });
  });
});
