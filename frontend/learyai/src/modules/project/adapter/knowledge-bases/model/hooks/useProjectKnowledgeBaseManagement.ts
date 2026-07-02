// useProjectKnowledgeBaseManagement 负责把知识库模块能力适配为项目详情页可直接消费的知识库管理契约。
import { resolveApiErrorMessage } from '@/shared/api/resolveApiError';
import {
  useCreateKnowledgeBase,
  useDeleteKnowledgeBase,
  useKnowledgeBaseList,
  useUpdateKnowledgeBase,
} from '@/modules/knowledge-base';

interface UseProjectKnowledgeBaseManagementParams {
  projectId: string;
  search: string;
  page: number;
  size: number;
}

export const useProjectKnowledgeBaseManagement = ({
  projectId,
  search,
  page,
  size,
}: UseProjectKnowledgeBaseManagementParams) => {
  const listQuery = useKnowledgeBaseList({
    projectId,
    search: search || undefined,
    sort: 'visitedAt',
    order: 'desc',
    page,
    size,
  });
  const createMutation = useCreateKnowledgeBase();
  const updateMutation = useUpdateKnowledgeBase();
  const deleteMutation = useDeleteKnowledgeBase();
  const knowledgeBases = listQuery.data?.items ?? [];
  const total = listQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / size));
  const listErrorMessage = listQuery.isError
    ? resolveApiErrorMessage(listQuery.error, '加载失败，请稍后重试')
    : null;

  return {
    listQuery,
    createMutation,
    updateMutation,
    deleteMutation,
    knowledgeBases,
    total,
    totalPages,
    listErrorMessage,
  };
};
