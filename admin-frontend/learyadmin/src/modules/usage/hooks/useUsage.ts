// 责任：管理管理员 usage 汇总、当前周期额度与事件分页查询状态。
import {useQuery} from '@tanstack/react-query';
import {
  usageApi,
  type UsageCurrentCycleParams,
  type UsageEventListParams,
  type UsageSummaryParams,
} from '../api/usage.api';

export function useUsageSummary(params: UsageSummaryParams | null) {
  const query = useQuery({
    queryKey: ['usage', 'summary', params],
    queryFn: () => usageApi.getSummary(params!),
    enabled: Boolean(params),
  });

  return {
    ...query,
    metrics: query.data?.data ?? [],
  };
}

export function useUsageCurrentCycle(params: UsageCurrentCycleParams | null) {
  const query = useQuery({
    queryKey: ['usage', 'current-cycle', params],
    queryFn: () => usageApi.getCurrentCycle(params!),
    enabled: Boolean(params?.userId && params?.projectId && params?.metric),
  });

  return {
    ...query,
    currentCycle: query.data?.data ?? null,
  };
}

export function useUsageEventList(params: UsageEventListParams | null) {
  const page = params?.page ?? 0;
  const size = params?.size ?? 20;
  const query = useQuery({
    queryKey: ['usage', 'event-list', {...params, page, size}],
    queryFn: () => usageApi.getEventList({...params!, page, size}),
    enabled: Boolean(params) && page >= 0 && size >= 1 && size <= 100,
  });

  return {
    ...query,
    pageData: query.data?.data,
  };
}
