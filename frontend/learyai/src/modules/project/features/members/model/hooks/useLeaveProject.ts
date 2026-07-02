// useLeaveProject 负责退出项目的操作流程。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectMemberApi } from '../../api/projectMemberApi';

interface LeaveProjectParams {
  projectId: string;
}

export const useLeaveProject = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, LeaveProjectParams>({
    mutationFn: ({ projectId }) => projectMemberApi.leaveProject(projectId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', 'members', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] });
    },
  });
};
