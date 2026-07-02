// 责任：管理资源发布审核任务列表查询和审批通过动作状态。
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { reviewTaskApi } from '../api/reviewTask.api';
import type { AdminReviewTaskItemResponse, AdminReviewTaskItemType } from '@/shared/types/api';

const REVIEW_TASK_QUERY_KEY = ['review-task', 'list'] as const;

export function useReviewTasks(params: { status?: string; itemType?: AdminReviewTaskItemType; page: number; size: number }) {
  const query = useQuery({
    queryKey: [...REVIEW_TASK_QUERY_KEY, params],
    queryFn: () => reviewTaskApi.list(params),
  });

  const data = query.data?.data;

  return {
    ...query,
    page: {
      page: data?.page ?? params.page,
      size: data?.size ?? params.size,
      total: data?.total ?? 0,
      items: (data?.items ?? []) as AdminReviewTaskItemResponse[],
    },
  };
}

export function useApproveReviewTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: reviewTaskApi.approve,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REVIEW_TASK_QUERY_KEY });
    },
  });
}
