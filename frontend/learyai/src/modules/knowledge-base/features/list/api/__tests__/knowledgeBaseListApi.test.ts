// knowledgeBaseListApi.test.ts 负责验证知识库列表 API 的请求参数与 DTO 映射。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

import { knowledgeBaseListApi } from '../knowledgeBaseListApi';

describe('knowledgeBaseListApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('fetchList 会把空筛选项归一为 undefined，并映射 ownerId/userId', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        items: [
          {
            kbId: 'kb-1',
            name: '产品知识库',
            ownerId: 7,
          },
          {
            kbId: 'kb-2',
            name: '运营知识库',
            userId: 8,
            description: '用于运营资料',
            tags: ['运营'],
            visibility: 'TEAM',
            visitedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        total: 2,
        page: 2,
        size: 50,
      },
    });

    await expect(
      knowledgeBaseListApi.fetchList({
        projectId: 'project-1',
        search: '',
        tag: '',
        sort: '',
        order: undefined,
        page: 2,
        size: 50,
      })
    ).resolves.toEqual({
      items: [
        {
          kbId: 'kb-1',
          name: '产品知识库',
          description: null,
          tags: [],
          enabledTemplatePluginIds: [],
          userId: 7,
          visibility: 'PRIVATE',
          visitedAt: null,
        },
        {
          kbId: 'kb-2',
          name: '运营知识库',
          description: '用于运营资料',
          tags: ['运营'],
          enabledTemplatePluginIds: [],
          userId: 8,
          visibility: 'TEAM',
          visitedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      total: 2,
      page: 2,
      size: 50,
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/knowledge-bases', {
      params: {
        projectId: 'project-1',
        search: undefined,
        tag: undefined,
        sort: undefined,
        order: undefined,
        page: 2,
        size: 50,
      },
    });
  });
});
