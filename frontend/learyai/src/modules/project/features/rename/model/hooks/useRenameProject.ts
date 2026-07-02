// useRenameProject 负责重命名项目的提交流程并刷新相关缓存。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectRenameApi, type ProjectRenamePayload } from '../../api/projectRenameApi';
import type { Project } from '../../../../entities';

interface RenameProjectParams {
  projectId: string;
  payload: ProjectRenamePayload;
}

export const useRenameProject = () => {
  const queryClient = useQueryClient();

  return useMutation<{ item: Project; message: string }, Error, RenameProjectParams>({
    mutationFn: ({ projectId, payload }) => projectRenameApi.rename(projectId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] });
    },
  });
};
