// projectDeleteApi 负责删除项目接口调用。
import { apiRequest } from '@/shared/api/client';
import type { ApiRes } from '@/shared/api/contract';

type DeleteProjectResponse = ApiRes<'/api/projects/{projectId}', 'delete'>;
type ApiVoidable<T> = [T] extends [never] ? void : T;

export const projectDeleteApi = {
  remove: async (projectId: string): Promise<void> => {
    await apiRequest<ApiVoidable<DeleteProjectResponse>>(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  },
};
