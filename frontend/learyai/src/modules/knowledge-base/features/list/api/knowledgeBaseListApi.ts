// knowledgeBaseListApi 负责获取知识库列表（分页）。
import { apiRequest } from '@/shared/api/client';
import type { ApiQuery, ApiRes } from '@/shared/api/contract';
import type { KnowledgeBase, KnowledgeBaseVisibility } from '../../../entities';

export interface KnowledgeBaseListParams {
  projectId: string;
  search?: string;
  tag?: string;
  sort?: string;
  order?: 'asc' | 'desc';
  page?: number;
  size?: number;
}

type KnowledgeBaseListQuery = ApiQuery<'/api/knowledge-bases', 'get'>;
type KnowledgeBaseListApiResponse = ApiRes<'/api/knowledge-bases', 'get'>;
type KnowledgeBaseListResponse = NonNullable<KnowledgeBaseListApiResponse['data']>;
type KnowledgeBaseDto = NonNullable<KnowledgeBaseListResponse['items']>[number] & {
  userId?: number;
  enabledTemplatePluginIds?: string[] | null;
};

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`knowledge base list api 响应缺少字段: ${field}`);
  }
  return value;
};

const mapKnowledgeBase = (dto: KnowledgeBaseDto): KnowledgeBase => ({
  kbId: requiredField(dto.kbId, 'kbId'),
  name: requiredField(dto.name, 'name'),
  description: dto.description ?? null,
  tags: dto.tags ?? [],
  enabledTemplatePluginIds: dto.enabledTemplatePluginIds ?? [],
  userId: dto.userId ?? requiredField(dto.ownerId, 'ownerId'),
  visibility: (dto.visibility ?? 'PRIVATE') as KnowledgeBaseVisibility,
  visitedAt: dto.visitedAt ?? null,
});

export const knowledgeBaseListApi = {
  fetchList: async (
    params: KnowledgeBaseListParams
  ): Promise<{ items: KnowledgeBase[]; total: number; page: number; size: number }> => {
    const response = await apiRequest<KnowledgeBaseListApiResponse>('/knowledge-bases', {
      params: {
        projectId: params.projectId,
        search: params.search || undefined,
        tag: params.tag || undefined,
        sort: params.sort || undefined,
        order: params.order || undefined,
        page: params.page,
        size: params.size,
      } satisfies KnowledgeBaseListQuery,
    });
    const data = requiredField(response.data, 'data');
    return {
      items: requiredField(data.items, 'data.items').map(mapKnowledgeBase),
      total: requiredField(data.total, 'data.total'),
      page: requiredField(data.page, 'data.page'),
      size: requiredField(data.size, 'data.size'),
    };
  },
};
