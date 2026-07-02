// 责任：管理管理员身份态探活与派生状态。
import {useQuery} from '@tanstack/react-query';
import {authApi} from '../api/auth.api';

export function useAuth() {
  const query = useQuery({
    queryKey: ['auth', 'probe-admin'],
    queryFn: () => authApi.probeAdmin(),
    retry: false,
  });

  return {
    ...query,
    isAdmin: query.isSuccess,
    totalUsers: query.data?.data?.totalUsers ?? 0,
  };
}
