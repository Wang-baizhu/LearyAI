// useCreateProject 负责新建项目的提交流程并刷新相关缓存。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectCreateApi, type ProjectCreatePayload } from '../../api/projectCreateApi';
import type { Project } from '../../../../entities';

export const useCreateProject = () => {
  const queryClient = useQueryClient();

  return useMutation<{ item: Project; message: string }, Error, ProjectCreatePayload>({
    mutationFn: (payload) => projectCreateApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
    },
  });
};
