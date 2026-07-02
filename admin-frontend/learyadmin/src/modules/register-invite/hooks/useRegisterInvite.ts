// 责任：管理管理员注册邀请码查询与写操作的 React Query 状态。
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {registerInviteApi, type RegisterInviteListParams} from '../api/registerInvite.api';

export function useRegisterInviteList(params: RegisterInviteListParams) {
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const query = useQuery({
    queryKey: ['register-invite', 'list', {...params, page, size}],
    queryFn: () => registerInviteApi.list({...params, page, size}),
    enabled: page >= 0 && size >= 1 && size <= 100,
  });

  return {
    ...query,
    pageData: query.data?.data,
  };
}

export function useRegisterInviteDetail(inviteId: number | undefined) {
  const query = useQuery({
    queryKey: ['register-invite', 'detail', inviteId],
    queryFn: () => registerInviteApi.detail(inviteId!),
    enabled: inviteId !== undefined,
  });

  return {
    ...query,
    detail: query.data?.data,
  };
}

export function useCreateRegisterInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerInviteApi.create,
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['register-invite', 'list']});
    },
  });
}

export function useDeactivateRegisterInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerInviteApi.deactivate,
    onSuccess: (response) => {
      void queryClient.invalidateQueries({queryKey: ['register-invite', 'list']});
      if (response.data?.inviteId !== undefined) {
        void queryClient.invalidateQueries({queryKey: ['register-invite', 'detail', response.data.inviteId]});
      }
    },
  });
}

export function useDeleteRegisterInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: registerInviteApi.remove,
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['register-invite', 'list']});
    },
  });
}
