// useRecentVisits 负责最近访问内容分页查询与缓存。
import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { visitRecentApi } from '../../api/visitRecentApi';
import type { RecentVisitPage } from '../../../../entities';

export const useRecentVisits = (size = 20) =>
  useInfiniteQuery<RecentVisitPage, Error, InfiniteData<RecentVisitPage>, [string, string, number], string | undefined>({
    queryKey: ['visits', 'recent', size],
    initialPageParam: undefined,
    queryFn: ({ pageParam }) => visitRecentApi.fetchRecent(size, pageParam),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor ?? undefined : undefined),
  });
