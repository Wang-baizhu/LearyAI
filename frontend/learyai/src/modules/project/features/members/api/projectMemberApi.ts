// projectMemberApi 负责项目成员列表与成员操作接口调用。
import { apiRequest } from '@/shared/api/client';
import type { ApiQuery, ApiReq, ApiRes } from '@/shared/api/contract';
import type { ProjectMember } from '../../../entities';

type ProjectMembersQuery = ApiQuery<'/api/projects/{projectId}/members', 'get'> extends never
  ? { page?: number; size?: number }
  : ApiQuery<'/api/projects/{projectId}/members', 'get'>;
type ProjectMembersResponse = ApiRes<'/api/projects/{projectId}/members', 'get'>;
type ProjectMembersData = NonNullable<ProjectMembersResponse['data']>;
type ProjectMemberDto = NonNullable<ProjectMembersData['items']>[number];
type ChangeMemberRoleRequestBody = ApiReq<'/api/projects/{projectId}/members/{userId}/role', 'patch'>;
type RemoveMemberResponse = ApiRes<'/api/projects/{projectId}/members/{userId}', 'delete'>;
type ChangeMemberRoleResponse = ApiRes<'/api/projects/{projectId}/members/{userId}/role', 'patch'>;
type LeaveProjectResponse = ApiRes<'/api/projects/{projectId}/leave', 'post'>;
type TransferProjectRequestBody = ApiReq<'/api/projects/{projectId}/transfer', 'post'>;
type TransferProjectResponse = ApiRes<'/api/projects/{projectId}/transfer', 'post'>;
type ApiVoidable<T> = [T] extends [never] ? void : T;

export type ProjectMemberListResponse = ProjectMembersResponse;

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`project member api 响应缺少字段: ${field}`);
  }
  return value;
};

const mapProjectMember = (dto: ProjectMemberDto): ProjectMember => ({
  userId: requiredField(dto.userId, 'userId'),
  name: dto.name ?? null,
  role: requiredField(dto.role, 'role'),
  status: requiredField(dto.status, 'status'),
  createdAt: dto.createdAt ?? null,
});

export const projectMemberApi = {
  fetchList: async (
    projectId: string,
    page = 1,
    size = 20
  ): Promise<{ items: ProjectMember[]; total: number; page: number; size: number }> => {
    const response = await apiRequest<ProjectMembersResponse>(`/projects/${projectId}/members`, {
      params: {
        page,
        size,
      } satisfies ProjectMembersQuery,
    });
    const data = requiredField(response.data, 'data');
    return {
      items: requiredField(data.items, 'data.items').map(mapProjectMember),
      total: requiredField(data.total, 'data.total'),
      page: requiredField(data.page, 'data.page'),
      size: requiredField(data.size, 'data.size'),
    };
  },
  removeMember: async (projectId: string, userId: number): Promise<void> => {
    await apiRequest<ApiVoidable<RemoveMemberResponse>>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    });
  },
  updateMemberRole: async (
    projectId: string,
    userId: number,
    role: ChangeMemberRoleRequestBody['role']
  ): Promise<void> => {
    await apiRequest<ApiVoidable<ChangeMemberRoleResponse>>(
      `/projects/${projectId}/members/${userId}/role`,
      {
        method: 'PATCH',
        body: {
          role,
        } satisfies ChangeMemberRoleRequestBody,
      }
    );
  },
  leaveProject: async (projectId: string): Promise<void> => {
    await apiRequest<ApiVoidable<LeaveProjectResponse>>(`/projects/${projectId}/leave`, {
      method: 'POST',
    });
  },
  transferOwner: async (projectId: string, targetUserId: number): Promise<void> => {
    await apiRequest<ApiVoidable<TransferProjectResponse>>(`/projects/${projectId}/transfer`, {
      method: 'POST',
      body: {
        targetUserId,
      } satisfies TransferProjectRequestBody,
    });
  },
};
