// 责任：封装管理员用户统计查询接口调用。
import {apiRequest} from '@/shared/api/client';
import type {
  AdminUserRecentLoginPageResponse,
  AdminUserSubscriptionCycleResponse,
  AdminUserSubscriptionCycleUpsertRequest,
  AdminUserSummaryResponse,
  ApiResponse,
} from '@/shared/types/api';

export interface RecentLoginParams {
  page?: number;
  size?: number;
}

export interface UserSubscriptionCycleParams {
  metric?: string;
}

export const userApi = {
  getSummary: () => apiRequest<ApiResponse<AdminUserSummaryResponse>>('/admin/users/summary', {method: 'GET'}),
  getUserDetail: (userId: number) =>
    apiRequest<ApiResponse<AdminUserRecentLoginPageResponse['items'][number]>>(`/admin/users/${userId}`, {
      method: 'GET',
    }),
  getRecentLogins: (params: RecentLoginParams) =>
    apiRequest<ApiResponse<AdminUserRecentLoginPageResponse>>('/admin/users/recent-logins', {
      method: 'GET',
      params,
    }),
  getSubscriptionCycles: (userId: number, params: UserSubscriptionCycleParams = {}) =>
    apiRequest<ApiResponse<AdminUserSubscriptionCycleResponse[]>>(`/admin/users/${userId}/subscription-cycles`, {
      method: 'GET',
      params,
    }),
  updateSubscriptionCycle: (userId: number, metric: string, body: AdminUserSubscriptionCycleUpsertRequest) =>
    apiRequest<ApiResponse<AdminUserSubscriptionCycleResponse>>(`/admin/users/${userId}/subscription-cycles/${metric}`, {
      method: 'PUT',
      body,
    }),
};
