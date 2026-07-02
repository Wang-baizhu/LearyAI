// knowledgeBaseRecentApi 负责获取最近访问知识库列表。
import { apiRequest } from '@/shared/api/client';
import type { ApiQuery, ApiRes } from '@/shared/api/contract';
import type { KnowledgeBase, KnowledgeBaseVisibility } from '../../../entities';

type RecentKnowledgeBaseQuery = Omit<ApiQuery<'/api/knowledge-bases/recent', 'get'>, 'projectId'> & {
  projectId?: ApiQuery<'/api/knowledge-bases/recent', 'get'>['projectId'];
};
type RecentKnowledgeBaseResponse = ApiRes<'/api/knowledge-bases/recent', 'get'>;
type KnowledgeBaseDto = NonNullable<RecentKnowledgeBaseResponse['data']>[number] & {
  userId?: number;
  enabledTemplatePluginIds?: string[] | null;
};

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`knowledge base recent api 响应缺少字段: ${field}`);
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

export const knowledgeBaseRecentApi = {
  fetchRecent: async (limit = 10, projectId?: string): Promise<KnowledgeBase[]> => {
    const response = await apiRequest<RecentKnowledgeBaseResponse>('/knowledge-bases/recent', {
      params: {
        limit,
        projectId,
      } satisfies RecentKnowledgeBaseQuery,
    });
    return requiredField(response.data, 'data').map(mapKnowledgeBase);
  },
};
