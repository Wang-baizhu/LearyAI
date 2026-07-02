// useUpdateKnowledgeBase 负责更新知识库的提交流程并刷新相关缓存。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  knowledgeBaseUpdateApi,
  type KnowledgeBaseUpdatePayload,
} from '../../api/knowledgeBaseUpdateApi';
import type { KnowledgeBase } from '../../../../entities';

interface UpdateKnowledgeBaseParams {
  kbId: string;
  projectId: string;
  payload: KnowledgeBaseUpdatePayload;
}

export const useUpdateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation<{ item: KnowledgeBase; message: string }, Error, UpdateKnowledgeBaseParams>({
    mutationFn: ({ kbId, payload, projectId }) => knowledgeBaseUpdateApi.update(kbId, payload, projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', 'recent', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', 'list', variables.projectId] });
    },
  });
};
