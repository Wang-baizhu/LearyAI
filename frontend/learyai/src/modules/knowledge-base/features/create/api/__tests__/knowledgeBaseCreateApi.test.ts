// knowledgeBaseCreateApi.test.ts 负责验证知识库创建 API 的默认值与 DTO 映射。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

import { knowledgeBaseCreateApi } from '../knowledgeBaseCreateApi';

describe('knowledgeBaseCreateApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('create 会补全默认字段并映射 KnowledgeBase', async () => {
    mocks.apiRequest.mockResolvedValue({
      data: {
        kbId: 'kb-1',
        name: '产品知识库',
        userId: 9,
      },
      message: '创建成功',
    });

    await expect(
      knowledgeBaseCreateApi.create({
        name: '产品知识库',
        projectId: 'project-1',
      })
    ).resolves.toEqual({
      item: {
        kbId: 'kb-1',
        name: '产品知识库',
        description: null,
        tags: [],
        enabledTemplatePluginIds: [],
        userId: 9,
        visibility: 'PRIVATE',
        visitedAt: null,
      },
      message: '创建成功',
    });

    expect(mocks.apiRequest).toHaveBeenCalledWith('/knowledge-bases', {
      method: 'POST',
      body: {
        name: '产品知识库',
        description: undefined,
        tags: [],
        projectId: 'project-1',
        visibility: 'PRIVATE',
        enabledTemplatePluginIds: [],
      },
    });
  });
});
