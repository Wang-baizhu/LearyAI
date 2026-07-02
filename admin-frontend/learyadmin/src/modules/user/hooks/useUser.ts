// 责任：管理管理员用户统计与会员周期配置的 React Query 状态。
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {userApi, type RecentLoginParams} from '../api/user.api';
import type {AdminUserSubscriptionCycleUpsertRequest} from '@/shared/types/api';

export function useUserSummary() {
  const query = useQuery({
    queryKey: ['user', 'summary'],
    queryFn: () => userApi.getSummary(),
  });

  return {
    ...query,
    summary: query.data?.data,
  };
}

export function useUserDetail(userId: number | null) {
  const query = useQuery({
    queryKey: ['user', 'detail', userId],
    queryFn: () => userApi.getUserDetail(userId!),
    enabled: userId !== null,
  });

  return {
    ...query,
    user: query.data?.data ?? null,
  };
}

export function useUserRecentLogins(params: RecentLoginParams) {
  const page = params.page ?? 0;
  const size = params.size ?? 20;
  const query = useQuery({
    queryKey: ['user', 'recent-logins', page, size],
    queryFn: () => userApi.getRecentLogins({page, size}),
    enabled: page >= 0 && size >= 1 && size <= 100,
  });

  return {
    ...query,
    pageData: query.data?.data,
  };
}

export function useUserSubscriptionCycles(userId: number | null, metric?: string) {
  const query = useQuery({
    queryKey: ['user', 'subscription-cycles', userId, metric ?? 'all'],
    queryFn: () => userApi.getSubscriptionCycles(userId!, metric ? {metric} : {}),
    enabled: userId !== null,
  });

  return {
    ...query,
    cycles: query.data?.data ?? [],
  };
}

export function useUpdateUserSubscriptionCycle(userId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({metric, body}: {metric: string; body: AdminUserSubscriptionCycleUpsertRequest}) =>
      userApi.updateSubscriptionCycle(userId!, metric, body),
    onSuccess: async () => {
      if (userId === null) {
        return;
      }
      await queryClient.invalidateQueries({queryKey: ['user', 'subscription-cycles', userId]});
      await queryClient.invalidateQueries({queryKey: ['user', 'subscription-cycles']});
    },
  });
}
