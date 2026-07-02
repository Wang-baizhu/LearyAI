// 责任：封装管理员会话探活接口调用。
import {apiRequest} from '@/shared/api/client';
import type {ApiResponse, AdminUserSummaryResponse} from '@/shared/types/api';

export const authApi = {
  probeAdmin: () => apiRequest<ApiResponse<AdminUserSummaryResponse>>('/admin/users/summary', {method: 'GET'}),
};
