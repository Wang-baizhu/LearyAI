// knowledgeBaseDeleteApi.test.ts 负责验证删除知识库 API 的请求参数。
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}));

vi.mock('@/shared/api/client', () => ({
  apiRequest: mocks.apiRequest,
}));

import { knowledgeBaseDeleteApi } from '../knowledgeBaseDeleteApi';

describe('knowledgeBaseDeleteApi', () => {
  beforeEach(() => {
    mocks.apiRequest.mockReset();
  });

  it('remove 会发送 DELETE 请求并附带 projectId 参数', async () => {
    mocks.apiRequest.mockResolvedValue(undefined);

    await expect(knowledgeBaseDeleteApi.remove('kb-1', 'project-1')).resolves.toBeUndefined();
    expect(mocks.apiRequest).toHaveBeenCalledWith('/knowledge-bases/kb-1', {
      method: 'DELETE',
      params: {
        projectId: 'project-1',
      },
    });
  });
});
