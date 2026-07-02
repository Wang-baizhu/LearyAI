// useAcceptProjectInvite 负责通过邀请码加入项目并刷新相关缓存。
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  projectInviteApi,
  type ProjectInviteAcceptPayload,
} from '../../api/projectInviteApi';

export const useAcceptProjectInvite = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ProjectInviteAcceptPayload>({
    mutationFn: (payload) => projectInviteApi.acceptInvite(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['projects', 'recent'] });
    },
  });
};
