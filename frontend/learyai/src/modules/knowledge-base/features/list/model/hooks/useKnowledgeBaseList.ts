// useKnowledgeBaseList 负责知识库分页列表查询与缓存。
import { useQuery } from '@tanstack/react-query';
import {
  knowledgeBaseListApi,
  type KnowledgeBaseListParams,
} from '../../api/knowledgeBaseListApi';
import type { KnowledgeBase } from '../../../../entities';

interface KnowledgeBaseListResult {
  items: KnowledgeBase[];
  total: number;
  page: number;
  size: number;
}

export const useKnowledgeBaseList = (params: KnowledgeBaseListParams) =>
  useQuery<KnowledgeBaseListResult>({
    queryKey: [
      'knowledge-base',
      'list',
      params.projectId,
      params.search ?? '',
      params.tag ?? '',
      params.sort ?? '',
      params.order ?? '',
      params.page ?? 1,
      params.size ?? 20,
    ],
    queryFn: () => knowledgeBaseListApi.fetchList(params),
    enabled: Boolean(params.projectId),
  });
