// knowledgeBaseDeleteApi 负责删除知识库接口调用。
import { apiRequest } from '@/shared/api/client';
import type { ApiQuery } from '@/shared/api/contract';

type DeleteKnowledgeBaseQuery = ApiQuery<'/api/knowledge-bases/{kbId}', 'delete'>;

export const knowledgeBaseDeleteApi = {
  remove: async (kbId: string, projectId: string): Promise<void> => {
    await apiRequest<void>(`/knowledge-bases/${kbId}`, {
      method: 'DELETE',
      params: {
        projectId,
      } satisfies DeleteKnowledgeBaseQuery,
    });
  },
};
