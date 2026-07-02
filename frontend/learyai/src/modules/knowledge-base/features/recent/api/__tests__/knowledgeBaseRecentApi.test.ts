// knowledgeBaseRecentApi.test.ts 负责验证最近知识库 API 的请求参数与 DTO 映射。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

import { knowledgeBaseRecentApi } from '../knowledgeBaseRecentApi';

describe('knowledgeBaseRecentApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('fetchRecent 会附带 limit/projectId，并映射默认 visibility 与 visitedAt', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: [
        {
          kbId: 'kb-1',
          name: '最近访问',
          userId: 3,
        },
      ],
    });

    await expect(knowledgeBaseRecentApi.fetchRecent(5, 'project-1')).resolves.toEqual([
      {
        kbId: 'kb-1',
        name: '最近访问',
        description: null,
        tags: [],
        enabledTemplatePluginIds: [],
        userId: 3,
        visibility: 'PRIVATE',
        visitedAt: null,
      },
    ]);

    expect(mocks.apiRequest).toHaveBeenCalledWith('/knowledge-bases/recent', {
      params: {
        limit: 5,
        projectId: 'project-1',
      },
    });
  });
});
