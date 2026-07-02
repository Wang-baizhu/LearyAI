// 责任：封装管理员任务 DLQ 事故记录查询、状态更新和删除接口调用。
import { apiRequest } from '@/shared/api/client';
import type {
  AdminTaskDlqIncidentPageResponse,
  AdminTaskDlqIncidentStatus,
  AdminTaskDlqIncidentStatusUpdateRequest,
  AdminTaskDlqIncidentItemResponse,
  AdminTaskDlqType,
  ApiResponse,
} from '@/shared/types/api';

export interface TaskDlqIncidentListParams {
  incidentStatus?: AdminTaskDlqIncidentStatus;
  dlqType?: AdminTaskDlqType;
  page?: number;
  size?: number;
}

export const taskDlqApi = {
  list: (params: TaskDlqIncidentListParams) =>
    apiRequest<ApiResponse<AdminTaskDlqIncidentPageResponse>>('/admin/task-dlq-incidents', {
      method: 'GET',
      params,
    }),
  updateStatus: (incidentId: number, body: AdminTaskDlqIncidentStatusUpdateRequest) =>
    apiRequest<ApiResponse<AdminTaskDlqIncidentItemResponse>>(`/admin/task-dlq-incidents/${incidentId}/status`, {
      method: 'PUT',
      body,
    }),
  remove: (incidentId: number) =>
    apiRequest<ApiResponse<null>>(`/admin/task-dlq-incidents/${incidentId}`, {
      method: 'DELETE',
    }),
};
