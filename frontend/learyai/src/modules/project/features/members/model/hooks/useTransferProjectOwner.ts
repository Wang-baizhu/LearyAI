// useTransferProjectOwner 负责移交项目所有者的操作流程。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectMemberApi } from '../../api/projectMemberApi';

interface TransferProjectOwnerParams {
  projectId: string;
  targetUserId: number;
}

export const useTransferProjectOwner = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, TransferProjectOwnerParams>({
    mutationFn: ({ projectId, targetUserId }) =>
      projectMemberApi.transferOwner(projectId, targetUserId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', 'members', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] });
    },
  });
};
