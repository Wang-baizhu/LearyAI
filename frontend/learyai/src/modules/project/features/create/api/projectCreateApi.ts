// projectCreateApi 负责新建项目接口调用与数据映射。
import { apiRequest } from '@/shared/api/client';
import type { ApiReq, ApiRes } from '@/shared/api/contract';
import type { Project } from '../../../entities';

export interface ProjectCreatePayload {
  name: string;
}

type CreateProjectRequestBody = ApiReq<'/api/projects', 'post'>;
type CreateProjectResponse = ApiRes<'/api/projects', 'post'>;
type ProjectDto = NonNullable<CreateProjectResponse['data']>;

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`project create api 响应缺少字段: ${field}`);
  }
  return value;
};

const mapProject = (dto: ProjectDto): Project => ({
  projectId: requiredField(dto.projectId, 'projectId'),
  name: requiredField(dto.name, 'name'),
  role: dto.role,
  createdAt: dto.createdAt ?? undefined,
  updatedAt: dto.updatedAt ?? undefined,
});

export const projectCreateApi = {
  create: async (payload: ProjectCreatePayload): Promise<{ item: Project; message: string }> => {
    const response = await apiRequest<CreateProjectResponse>('/projects', {
      method: 'POST',
      body: {
        name: payload.name,
      } satisfies CreateProjectRequestBody,
    });
    return {
      item: mapProject(requiredField(response.data, 'data')),
      message: requiredField(response.message, 'message'),
    };
  },
};
