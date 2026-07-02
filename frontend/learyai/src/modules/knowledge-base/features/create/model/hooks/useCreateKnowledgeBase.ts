// useCreateKnowledgeBase 负责新建知识库的提交流程并刷新相关缓存。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  knowledgeBaseCreateApi,
  type KnowledgeBaseCreatePayload,
} from '../../api/knowledgeBaseCreateApi';
import type { KnowledgeBase } from '../../../../entities';

export const useCreateKnowledgeBase = () => {
  const queryClient = useQueryClient();

  return useMutation<{ item: KnowledgeBase; message: string }, Error, KnowledgeBaseCreatePayload>({
    mutationFn: (payload) => knowledgeBaseCreateApi.create(payload),
    onSuccess: (_result, payload) => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', 'recent', payload.projectId] });
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', 'list', payload.projectId] });
    },
  });
};
