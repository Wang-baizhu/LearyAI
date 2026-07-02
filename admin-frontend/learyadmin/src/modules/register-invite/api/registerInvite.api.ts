// 责任：封装管理员注册邀请码管理接口调用。
import {apiRequest} from '@/shared/api/client';
import type {
  AdminRegisterInviteCreateRequest,
  AdminRegisterInviteDetailResponse,
  AdminRegisterInvitePageResponse,
  AdminRegisterInviteStatus,
  ApiResponse,
} from '@/shared/types/api';

export interface RegisterInviteListParams {
  status?: AdminRegisterInviteStatus;
  page?: number;
  size?: number;
}

export const registerInviteApi = {
  list: (params: RegisterInviteListParams) =>
    apiRequest<ApiResponse<AdminRegisterInvitePageResponse>>('/admin/register-invites', {
      method: 'GET',
      params,
    }),
  detail: (inviteId: number) =>
    apiRequest<ApiResponse<AdminRegisterInviteDetailResponse>>(`/admin/register-invites/${inviteId}`, {
      method: 'GET',
    }),
  create: (body: AdminRegisterInviteCreateRequest) =>
    apiRequest<ApiResponse<AdminRegisterInviteDetailResponse[]>>('/admin/register-invites', {
      method: 'POST',
      body,
    }),
  deactivate: (inviteId: number) =>
    apiRequest<ApiResponse<AdminRegisterInviteDetailResponse>>(`/admin/register-invites/${inviteId}:inactive`, {
      method: 'PUT',
    }),
  remove: (inviteId: number) =>
    apiRequest<ApiResponse<null>>(`/admin/register-invites/${inviteId}`, {
      method: 'DELETE',
    }),
};
