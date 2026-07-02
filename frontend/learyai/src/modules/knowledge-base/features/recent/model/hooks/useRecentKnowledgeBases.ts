// useRecentKnowledgeBases 负责最近访问知识库列表的查询与缓存。
import { useQuery } from '@tanstack/react-query';
import { knowledgeBaseRecentApi } from '../../api/knowledgeBaseRecentApi';
import type { KnowledgeBase } from '../../../../entities';

export const useRecentKnowledgeBases = (limit = 10, projectId?: string) =>
  useQuery<KnowledgeBase[]>({
    queryKey: ['knowledge-base', 'recent', projectId, limit],
    queryFn: () => knowledgeBaseRecentApi.fetchRecent(limit, projectId),
    enabled: Boolean(projectId),
  });
