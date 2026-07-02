// useDeleteKnowledgeBase 负责删除知识库的提交流程并刷新相关缓存。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { knowledgeBaseDeleteApi } from '../../api/knowledgeBaseDeleteApi';

interface DeleteKnowledgeBaseParams {
  kbId: string;
  projectId: string;
}

export const useDeleteKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteKnowledgeBaseParams>({
    mutationFn: ({ kbId, projectId }) => knowledgeBaseDeleteApi.remove(kbId, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', 'recent', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', 'list', variables.projectId] });
    },
  });
};
