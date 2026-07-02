// useUpdateProjectMemberRole 负责更新项目成员角色的操作流程。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectMemberApi } from '../../api/projectMemberApi';

interface UpdateProjectMemberRoleParams {
  projectId: string;
  userId: number;
  role: 'ADMIN' | 'MEMBER';
}

export const useUpdateProjectMemberRole = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateProjectMemberRoleParams>({
    mutationFn: ({ projectId, userId, role }) =>
      projectMemberApi.updateMemberRole(projectId, userId, role),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['project', 'members', variables.projectId] });
    },
  });
};
