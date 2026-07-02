// 责任：封装管理员邀请码查询接口调用。
import {apiRequest} from '@/shared/api/client';
import type {AdminInviteStatus, ApiResponse, AdminInviteDetailResponse, AdminInvitePageResponse} from '@/shared/types/api';

export interface InviteListParams {
  status?: AdminInviteStatus;
  projectId?: string;
  creatorUserId?: number;
  page?: number;
  size?: number;
}

export const inviteApi = {
  list: (params: InviteListParams) =>
    apiRequest<ApiResponse<AdminInvitePageResponse>>('/admin/invites', {
      method: 'GET',
      params,
    }),
  detail: (inviteId: number) =>
    apiRequest<ApiResponse<AdminInviteDetailResponse>>(`/admin/invites/${inviteId}`, {method: 'GET'}),
};
