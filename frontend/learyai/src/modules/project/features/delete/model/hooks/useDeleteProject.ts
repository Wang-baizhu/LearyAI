// useDeleteProject 负责删除项目的提交流程并刷新相关缓存。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectDeleteApi } from '../../api/projectDeleteApi';

interface DeleteProjectParams {
  projectId: string;
}

export const useDeleteProject = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteProjectParams>({
    mutationFn: ({ projectId }) => projectDeleteApi.remove(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] });
    },
  });
};
