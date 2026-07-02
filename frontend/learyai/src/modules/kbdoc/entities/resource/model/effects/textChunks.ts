// textChunks 负责拉取文档文本分块分页数据。
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiQuery, ApiRes } from '@/shared/api/contract';

export interface TextChunkItem {
  chunkSec: number;
  text: string;
}

export interface TextChunkPage {
  items: TextChunkItem[];
  hasMore: boolean;
  nextChunkSec: number;
}

type TextChunkPageApiResponse = ApiRes<'/api/kb/docs/{docId}/text-chunks', 'get'>;

const unwrapResponse = <T>(response: Pick<Partial<ApiEnvelope<T>>, 'data'>) => response.data;

export const fetchTextChunksPage = async (
  docId: string,
  startChunkSec: number,
  size: number,
  projectId?: string
): Promise<TextChunkPage> => {
  const params: Partial<ApiQuery<'/api/kb/docs/{docId}/text-chunks', 'get'>> = {
    startChunkSec,
    size,
    projectId,
  };
  const response = await apiRequest<TextChunkPageApiResponse>(`/kb/docs/${docId}/text-chunks`, {
    params,
  });
  return unwrapResponse(response) as TextChunkPage;
};
