// projectRenameApi 负责重命名项目接口调用与数据映射。
import { apiRequest } from '@/shared/api/client';
import type { ApiReq, ApiRes } from '@/shared/api/contract';
import type { Project } from '../../../entities';

export interface ProjectRenamePayload {
  name: string;
}

type RenameProjectRequestBody = ApiReq<'/api/projects/{projectId}', 'patch'>;
type RenameProjectResponse = ApiRes<'/api/projects/{projectId}', 'patch'>;
type ProjectDto = NonNullable<RenameProjectResponse['data']>;

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`project rename api 响应缺少字段: ${field}`);
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

export const projectRenameApi = {
  rename: async (
    projectId: string,
    payload: ProjectRenamePayload
  ): Promise<{ item: Project; message: string }> => {
    const response = await apiRequest<RenameProjectResponse>(`/projects/${projectId}`, {
      method: 'PATCH',
      body: {
        name: payload.name,
      } satisfies RenameProjectRequestBody,
    });
    return {
      item: mapProject(requiredField(response.data, 'data')),
      message: requiredField(response.message, 'message'),
    };
  },
};
