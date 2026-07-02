// projectListApi 负责获取项目列表。
import { apiRequest } from '@/shared/api/client';
import type { ApiQuery, ApiRes } from '@/shared/api/contract';
import type { Project } from '../../../entities';

type ProjectListQuery = ApiQuery<'/api/projects', 'get'> extends never
  ? { page?: number; size?: number }
  : ApiQuery<'/api/projects', 'get'>;
type ProjectListResponse = ApiRes<'/api/projects', 'get'>;
type ProjectListData = NonNullable<ProjectListResponse['data']>;
type ProjectDto = NonNullable<ProjectListData['items']>[number];

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`project list api 响应缺少字段: ${field}`);
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

export const projectListApi = {
  fetchList: async (page = 1, size = 20): Promise<Project[]> => {
    const response = await apiRequest<ProjectListResponse>('/projects', {
      params: {
        page,
        size,
      } satisfies ProjectListQuery,
    });
    return requiredField(requiredField(response.data, 'data').items, 'data.items').map(mapProject);
  },
};
