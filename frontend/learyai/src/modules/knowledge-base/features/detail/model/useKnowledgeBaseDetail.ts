// useKnowledgeBaseDetail 负责知识库详情查询与缓存。
import { useQuery } from '@tanstack/react-query';
import type { KnowledgeBase } from '../../../entities';
import { knowledgeBaseDetailApi } from '../api/knowledgeBaseDetailApi';

export const useKnowledgeBaseDetail = (kbId?: string, projectId?: string) =>
  useQuery<KnowledgeBase | null>({
    queryKey: ['knowledge-base', 'detail', kbId ?? 'none', projectId ?? 'none'],
    queryFn: async () => {
      if (!kbId || !projectId) return null;
      return knowledgeBaseDetailApi.fetch(kbId, projectId);
    },
    enabled: Boolean(kbId) && Boolean(projectId),
  });
