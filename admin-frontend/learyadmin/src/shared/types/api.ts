// 责任：基于 backend.generated 的 OpenAPI 类型，导出管理端 API 使用的类型别名。
import type { components } from './backend.generated';

type BackendSchemas = components['schemas'];
type AnyApiResponse = BackendSchemas['ApiResponseAdminUserSummaryResponse'];

export interface ApiResponse<T> extends Omit<AnyApiResponse, 'data'> {
  code: string;
  message: string;
  data: T;
}

export interface UploadPolicyResponse {
  provider: string;
  uploadUrl: string;
  method: string;
  headers?: Record<string, string> | null;
  fields?: Record<string, string> | null;
  expiresAt: string;
}

export type AdminUsageWindowType = 'last_24_hours' | 'last_30_days';
export type AdminInviteStatus = 'ACTIVE' | 'USED_UP' | 'EXPIRED' | 'REVOKED';
export type AdminRegisterInviteStatus = 'ACTIVE' | 'INACTIVE' | 'USED';
export type AdminReviewTaskItemType = 'KB' | 'TEMPLATE' | 'PLUGIN';
export type AdminTaskDlqIncidentStatus = 'OPEN' | 'COMPENSATED' | 'RESOLVED' | 'IGNORED';
export type AdminTaskDlqType = 'COMMAND' | 'STATUS';

export const ADMIN_USAGE_METRICS = [
  'ai_chat_tokens',
  'kbdoc_size',
] as const;

export type AdminUsageMetric = (typeof ADMIN_USAGE_METRICS)[number];

export type AdminUserSummaryResponse = BackendSchemas['AdminUserSummaryResponse'];
export type AdminUserRecentLoginItemResponse = BackendSchemas['AdminUserRecentLoginItemResponse'];
export type AdminUserRecentLoginPageResponse = BackendSchemas['AdminUserRecentLoginPageResponse'];
export interface AdminUserSubscriptionCycleResponse {
  id: number | null;
  userId: number;
  metric: string;
  planId: string;
  quota: number;
  validFrom: string;
  validTo: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUserSubscriptionCycleUpsertRequest {
  planId: string;
  quota: number;
  validFrom: string;
  validTo: string;
}

export interface AdminUsageMetricSummaryResponse {
  metric: string;
  used: number;
  reserved: number;
  quota: number;
  available: number;
}

export interface AdminUsageCurrentCycleResponse {
  userId: number;
  projectId: string;
  metric: string;
  cycleId: number;
  used: number;
  reserved: number;
  quota: number;
  available: number;
  validFrom: string;
  validTo: string;
  updatedAt: string;
}

export interface AdminUsageEventListItemResponse {
  userId: number;
  projectId: string;
  metric: string;
  delta: number;
  idempotencyKey: string;
  sourceType: string;
  sourceId: string;
  occurredAt: string;
  createdAt: string;
}

export interface AdminUsageEventPageResponse {
  page: number;
  size: number;
  total: number;
  items: AdminUsageEventListItemResponse[];
}
export type AdminInviteItemResponse = BackendSchemas['AdminInviteItemResponse'];
export type AdminInvitePageResponse = BackendSchemas['AdminInvitePageResponse'];
export type AdminInviteDetailResponse = BackendSchemas['AdminInviteDetailResponse'];
export type AdminRegisterInviteCreateRequest = BackendSchemas['AdminRegisterInviteCreateRequest'];
export type AdminRegisterInviteItemResponse = BackendSchemas['AdminRegisterInviteItemResponse'];
export type AdminRegisterInvitePageResponse = BackendSchemas['AdminRegisterInvitePageResponse'];
export type AdminRegisterInviteDetailResponse = BackendSchemas['AdminRegisterInviteDetailResponse'];
export type AdminTaskDlqIncidentItemResponse = BackendSchemas['AdminTaskDlqIncidentItemResponse'];
export type AdminTaskDlqIncidentPageResponse = BackendSchemas['AdminTaskDlqIncidentPageResponse'];
export type AdminTaskDlqIncidentStatusUpdateRequest = BackendSchemas['AdminTaskDlqIncidentStatusUpdateRequest'];

export type AdminReviewTaskItemResponse = BackendSchemas['AdminReviewTaskItemResponse'];
export type AdminReviewTaskPageResponse = BackendSchemas['AdminReviewTaskPageResponse'];
export type AdminReviewTaskResponse = BackendSchemas['AdminReviewTaskResponse'];

export interface AdminTemplateDevPackageVersionItemResponse {
  platform: string;
  version: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  status: string;
  createdBy?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminTemplateDevPackageUploadPrepareResponse {
  platform: string;
  version: string;
  fileName: string;
  objectKey: string;
  contentType: string;
  size: number;
  uploadPolicy: UploadPolicyResponse;
}

export interface AdminTemplateDevPackageUploadConfirmResponse {
  platform: string;
  version: string;
  status: string;
}

export interface AdminTemplateDevPackageVersionActivateResponse {
  platform: string;
  version: string;
  status: string;
}
