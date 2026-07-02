// query 负责封装任务列表分页请求。
import { useInfiniteQuery } from '@tanstack/react-query';
import type { TaskListParams, TaskListResponse } from '../types';
import { taskApi } from '../effects/api';

export const useTaskList = (params: TaskListParams = {}, options?: { enabled?: boolean }) =>
  useInfiniteQuery<TaskListResponse>({
    queryKey: ['task', 'list', params],
    initialPageParam: params.page ?? 1,
    queryFn: ({ pageParam }) =>
      taskApi.getTaskList({
        ...params,
        page: Number(pageParam),
      }),
    getNextPageParam: (lastPage) => (
      lastPage.page * lastPage.size < lastPage.total ? lastPage.page + 1 : undefined
    ),
    enabled: (options?.enabled ?? true) && Boolean(params.projectId && params.kbId),
  });
