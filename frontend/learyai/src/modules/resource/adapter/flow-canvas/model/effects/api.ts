// api 负责对接资源中心全局视图所需的知识库 canvas 与轻量全集接口。
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiQuery, ApiReq, ApiRes } from '@/shared/api/contract';
import type {
  FlowCanvasResourceCatalog,
  FlowCanvasSnapshot,
} from '@/modules/flow-canvas';

type CanvasQuery = ApiQuery<'/api/knowledge-bases/{kbId}/canvas', 'get'>;
type CanvasApiResponse = ApiRes<'/api/knowledge-bases/{kbId}/canvas', 'get'>;
type CanvasApiData = NonNullable<CanvasApiResponse['data']>;
type UpdateCanvasRequest = ApiReq<'/api/knowledge-bases/{kbId}/canvas', 'patch'>;
type UpdateCanvasApiResponse = ApiRes<'/api/knowledge-bases/{kbId}/canvas', 'patch'>;
type UpdateCanvasApiData = NonNullable<UpdateCanvasApiResponse['data']>;
type ResourceCenterOptionsQuery = ApiQuery<'/api/resource-center/options', 'get'>;
type ResourceCenterOptionsApiResponse = ApiRes<'/api/resource-center/options', 'get'>;
type ResourceCenterOptionsApiData = NonNullable<ResourceCenterOptionsApiResponse['data']>;

const unwrapResponse = <T>(response: Pick<Partial<ApiEnvelope<T>>, 'data'>) => response.data;

const normalizeCanvas = (
  response: CanvasApiData | UpdateCanvasApiData | undefined
): Record<string, unknown> => response?.canvas ?? {};

const normalizeResourceCatalog = (
  response: ResourceCenterOptionsApiData | undefined
): FlowCanvasResourceCatalog => ({
  docs: (response?.docs ?? [])
    .filter((item) => item.docId && item.name)
    .map((item) => ({
      docId: item.docId as string,
      name: item.name as string,
      status: item.status,
    })),
  templates: [],
});

export const resourceFlowCanvasApi = {
  getCanvas: async (projectId: string, kbId: string) => {
    const params: CanvasQuery = { projectId };
    const response = await apiRequest<CanvasApiResponse>(`/knowledge-bases/${kbId}/canvas`, {
      params,
    });
    return normalizeCanvas(unwrapResponse(response) as CanvasApiData);
  },
  updateCanvas: async (projectId: string, kbId: string, snapshot: FlowCanvasSnapshot) => {
    const params: CanvasQuery = { projectId };
    const body: UpdateCanvasRequest = {
      canvas: snapshot as unknown as Record<string, unknown>,
    };
    const response = await apiRequest<UpdateCanvasApiResponse>(`/knowledge-bases/${kbId}/canvas`, {
      method: 'PATCH',
      params,
      body,
    });
    return normalizeCanvas(unwrapResponse(response) as UpdateCanvasApiData);
  },
  getResourceCatalog: async (projectId: string, kbId: string) => {
    const params: ResourceCenterOptionsQuery = { projectId, kbId };
    const response = await apiRequest<ResourceCenterOptionsApiResponse>('/resource-center/options', {
      params,
    });
    return normalizeResourceCatalog(unwrapResponse(response) as ResourceCenterOptionsApiData);
  },
};
