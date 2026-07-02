// 责任：封装管理员资源发布审核任务查询与审批接口调用。
import { apiRequest } from '@/shared/api/client';
import type {
  AdminReviewTaskItemType,
  AdminReviewTaskPageResponse,
  AdminReviewTaskResponse,
  ApiResponse,
} from '@/shared/types/api';

export interface ReviewTaskListParams {
  status?: string;
  itemType?: AdminReviewTaskItemType;
  page?: number;
  size?: number;
}

export const reviewTaskApi = {
  list: (params: ReviewTaskListParams) =>
    apiRequest<ApiResponse<AdminReviewTaskPageResponse>>('/admin/review-tasks', {
      method: 'GET',
      params,
    }),
  approve: (reviewTaskId: string) =>
    apiRequest<ApiResponse<AdminReviewTaskResponse>>(
      `/admin/review-tasks/${encodeURIComponent(reviewTaskId)}:approve`,
      {
        method: 'POST',
      },
    ),
};
