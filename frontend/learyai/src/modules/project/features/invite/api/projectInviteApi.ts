// projectInviteApi 负责项目邀请相关接口调用。
import { apiRequest } from '@/shared/api/client';
import type { ApiReq, ApiRes } from '@/shared/api/contract';

export interface ProjectInviteCreatePayload {
  projectId: string;
  maxUse: number;
  expiresAt: string;
}

export interface ProjectInviteAcceptPayload {
  inviteCode: string;
}

type CreateInviteRequestBody = ApiReq<'/api/projects/{projectId}/invites', 'post'>;
type CreateInviteResponse = ApiRes<'/api/projects/{projectId}/invites', 'post'>;
type AcceptInviteRequestBody = ApiReq<'/api/projects/invites/accept', 'post'>;
type AcceptInviteResponse = ApiRes<'/api/projects/invites/accept', 'post'>;

export interface ProjectInviteCreateResult {
  id: number;
  code: string;
  status: string;
  expiresAt: string;
}

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`project invite api 响应缺少字段: ${field}`);
  }
  return value;
};

export const projectInviteApi = {
  createInvite: async (payload: ProjectInviteCreatePayload): Promise<ProjectInviteCreateResult> => {
    const response = await apiRequest<CreateInviteResponse>(
      `/projects/${payload.projectId}/invites`,
      {
        method: 'POST',
        body: {
          maxUse: payload.maxUse,
          expiresAt: payload.expiresAt,
        } satisfies CreateInviteRequestBody,
      }
    );
    const data = requiredField(response.data, 'data');
    return {
      id: requiredField(data.id, 'data.id'),
      code: requiredField(data.code, 'data.code'),
      status: requiredField(data.status, 'data.status'),
      expiresAt: requiredField(data.expiresAt, 'data.expiresAt'),
    };
  },
  acceptInvite: async (payload: ProjectInviteAcceptPayload): Promise<void> => {
    await apiRequest<AcceptInviteResponse>('/projects/invites/accept', {
      method: 'POST',
      body: {
        inviteCode: payload.inviteCode,
      } satisfies AcceptInviteRequestBody,
    });
  },
};
