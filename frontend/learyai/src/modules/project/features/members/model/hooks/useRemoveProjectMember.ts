// useRemoveProjectMember 负责移除项目成员的操作流程。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectMemberApi } from '../../api/projectMemberApi';

interface RemoveProjectMemberParams {
  projectId: string;
  userId: number;
}

export const useRemoveProjectMember = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, RemoveProjectMemberParams>({
    mutationFn: ({ projectId, userId }) => projectMemberApi.removeMember(projectId, userId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', 'members', variables.projectId] });
    },
  });
};
