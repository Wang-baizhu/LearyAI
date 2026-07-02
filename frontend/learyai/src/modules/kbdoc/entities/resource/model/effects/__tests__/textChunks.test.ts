// textChunks.test.ts 负责验证文档文本分块请求的参数与响应解包逻辑。
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/shared/api/client';
import { fetchTextChunksPage } from '../textChunks';

vi.mock('@/shared/api/client', () => ({
  apiRequest: vi.fn(),
}));

const mockedApiRequest = vi.mocked(apiRequest);

describe('fetchTextChunksPage', () => {
  beforeEach(() => {
    mockedApiRequest.mockReset();
  });

  it('会调用文本分块接口并返回 data 字段', async () => {
    mockedApiRequest.mockResolvedValue({
      data: {
        items: [{ chunkSec: 10, text: '第一段文本' }],
        hasMore: true,
        nextChunkSec: 20,
      },
    });

    const result = await fetchTextChunksPage('doc-1', 10, 5, 'project-1');

    expect(mockedApiRequest).toHaveBeenCalledWith('/kb/docs/doc-1/text-chunks', {
      params: {
        startChunkSec: 10,
        size: 5,
        projectId: 'project-1',
      },
    });
    expect(result).toEqual({
      items: [{ chunkSec: 10, text: '第一段文本' }],
      hasMore: true,
      nextChunkSec: 20,
    });
  });
});
