// 责任：管理管理员邀请码查询的 React Query 状态与数据映射。
import {useQuery} from '@tanstack/react-query';
import {inviteApi, type InviteListParams} from '../api/invite.api';

export function useInviteList(params: InviteListParams) {
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const query = useQuery({
    queryKey: ['invite', 'list', {...params, page, size}],
    queryFn: () => inviteApi.list({...params, page, size}),
    enabled: page >= 0 && size >= 1 && size <= 100,
  });

  return {
    ...query,
    pageData: query.data?.data,
  };
}

export function useInviteDetail(inviteId: number | undefined) {
  const query = useQuery({
    queryKey: ['invite', 'detail', inviteId],
    queryFn: () => inviteApi.detail(inviteId!),
    enabled: inviteId !== undefined,
  });

  return {
    ...query,
    detail: query.data?.data,
  };
}
