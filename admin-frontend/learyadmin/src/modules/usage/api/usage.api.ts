// 责任：封装管理员 usage 汇总、当前周期额度与事件明细查询接口调用。
import {apiRequest} from '@/shared/api/client';
import type {
  AdminUsageCurrentCycleResponse,
  AdminUsageEventPageResponse,
  AdminUsageMetricSummaryResponse,
  AdminUsageWindowType,
  ApiResponse,
} from '@/shared/types/api';

interface UsageBaseParams {
  windowType?: AdminUsageWindowType;
  from?: string;
  to?: string;
  userId?: number;
  projectId?: string;
}

export interface UsageSummaryParams extends UsageBaseParams {}

export interface UsageCurrentCycleParams {
  userId: number;
  projectId: string;
  metric: string;
}

export interface UsageEventListParams extends UsageBaseParams {
  metric?: string;
  page?: number;
  size?: number;
}

export const usageApi = {
  getSummary: (params: UsageSummaryParams) =>
    apiRequest<ApiResponse<AdminUsageMetricSummaryResponse[]>>('/admin/usage/summary', {
      method: 'GET',
      params,
    }),
  getCurrentCycle: (params: UsageCurrentCycleParams) =>
    apiRequest<ApiResponse<AdminUsageCurrentCycleResponse>>('/admin/usage/current-cycle', {
      method: 'GET',
      params,
    }),
  getEventList: (params: UsageEventListParams) =>
    apiRequest<ApiResponse<AdminUsageEventPageResponse>>('/admin/usage/event/list', {
      method: 'GET',
      params,
    }),
};
