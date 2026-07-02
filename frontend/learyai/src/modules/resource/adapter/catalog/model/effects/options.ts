// options 负责对接资源中心聚合 options 接口并提取文档候选项。
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiQuery, ApiRes } from '@/shared/api/contract';
import type { ResourceOptionItem } from '@/modules/kbdoc';

type ResourceCenterOptionsQuery = ApiQuery<'/api/resource-center/options', 'get'>;
type ResourceCenterOptionsApiResponse = ApiRes<'/api/resource-center/options', 'get'>;
type ResourceCenterOptionsApiData = NonNullable<ResourceCenterOptionsApiResponse['data']>;

const unwrapResponse = <T>(response: Pick<Partial<ApiEnvelope<T>>, 'data'>) => response.data;

const normalizeDocOptions = (response: ResourceCenterOptionsApiData | undefined): ResourceOptionItem[] =>
  (response?.docs ?? [])
    .filter((item) => item.docId && item.name)
    .map((item) => ({
      docId: item.docId as string,
      name: item.name as string,
      status: (item.status as ResourceOptionItem['status']) ?? 'DONE',
    }));

export const resourceCenterOptionsApi = {
  getDocOptions: async (projectId: string, kbId: string) => {
    const params: ResourceCenterOptionsQuery = { projectId, kbId };
    const response = await apiRequest<ResourceCenterOptionsApiResponse>('/resource-center/options', {
      params,
    });
    return normalizeDocOptions(unwrapResponse(response) as ResourceCenterOptionsApiData);
  },
};
