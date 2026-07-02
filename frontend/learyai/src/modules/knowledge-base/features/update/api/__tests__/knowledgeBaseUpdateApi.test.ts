// knowledgeBaseUpdateApi.test.ts 负责验证知识库更新 API 的默认值、参数与 DTO 映射。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

import { knowledgeBaseUpdateApi } from '../knowledgeBaseUpdateApi';

describe('knowledgeBaseUpdateApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('update 会以 PATCH 提交更新内容，并映射返回 DTO', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        kbId: 'kb-1',
        name: '更新后的知识库',
        userId: 5,
      },
      message: '更新成功',
    });

    await expect(
      knowledgeBaseUpdateApi.update(
        'kb-1',
        {
          name: '更新后的知识库',
        },
        'project-1'
      )
    ).resolves.toEqual({
      item: {
        kbId: 'kb-1',
        name: '更新后的知识库',
        description: null,
        tags: [],
        enabledTemplatePluginIds: [],
        userId: 5,
        visibility: 'PRIVATE',
        visitedAt: null,
      },
      message: '更新成功',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/knowledge-bases/kb-1', {
      method: 'PATCH',
      params: {
        projectId: 'project-1',
      },
      body: {
        name: '更新后的知识库',
        description: undefined,
        tags: [],
        visibility: undefined,
      },
    });
  });
});
