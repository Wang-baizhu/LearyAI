// knowledgeBaseDetailApi 负责获取知识库详情并映射领域实体。
import { apiRequest } from '@/shared/api/client';
import type { ApiQuery, ApiRes } from '@/shared/api/contract';
import type { KnowledgeBase, KnowledgeBaseVisibility } from '../../../entities';

type DetailKnowledgeBaseQuery = ApiQuery<'/api/knowledge-bases/{kbId}', 'get'>;
type DetailKnowledgeBaseResponse = ApiRes<'/api/knowledge-bases/{kbId}', 'get'>;
type KnowledgeBaseDto = NonNullable<DetailKnowledgeBaseResponse['data']> & {
  ownerId?: number | null;
  enabledTemplatePluginIds?: string[] | null;
};

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value == null) {
    throw new Error(`knowledge base detail api 响应缺少字段: ${field}`);
  }
  return value;
};

const mapKnowledgeBase = (dto: KnowledgeBaseDto): KnowledgeBase => ({
  kbId: requiredField(dto.kbId, 'kbId'),
  name: requiredField(dto.name, 'name'),
  description: dto.description ?? null,
  tags: dto.tags ?? [],
  enabledTemplatePluginIds: dto.enabledTemplatePluginIds ?? [],
  userId: dto.ownerId ?? 0,
  visibility: (dto.visibility ?? 'PRIVATE') as KnowledgeBaseVisibility,
  visitedAt: dto.visitedAt ?? null,
});

export const knowledgeBaseDetailApi = {
  fetch: async (kbId: string, projectId: string): Promise<KnowledgeBase> => {
    const response = await apiRequest<DetailKnowledgeBaseResponse>(`/knowledge-bases/${kbId}`, {
      params: {
        projectId,
      } satisfies DetailKnowledgeBaseQuery,
    });
    return mapKnowledgeBase(requiredField(response.data, 'data'));
  },
};
