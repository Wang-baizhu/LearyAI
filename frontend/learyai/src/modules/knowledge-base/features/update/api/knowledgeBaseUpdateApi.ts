// knowledgeBaseUpdateApi 负责更新知识库接口调用与数据映射。
import { apiRequest } from '@/shared/api/client';
import type { ApiQuery, ApiReq, ApiRes } from '@/shared/api/contract';
import type { KnowledgeBase, KnowledgeBaseVisibility } from '../../../entities';

export interface KnowledgeBaseUpdatePayload {
  name?: string;
  description?: string | null;
  tags?: string[];
  enabledTemplatePluginIds?: string[];
  visibility?: KnowledgeBaseVisibility;
}

type UpdateKnowledgeBaseQuery = ApiQuery<'/api/knowledge-bases/{kbId}', 'patch'>;
type UpdateKnowledgeBaseRequest = ApiReq<'/api/knowledge-bases/{kbId}', 'patch'> extends never
  ? {
      description?: string;
      name?: string;
      tags?: string[];
      enabledTemplatePluginIds?: string[];
      visibility?: string;
    }
  : ApiReq<'/api/knowledge-bases/{kbId}', 'patch'>;
type UpdateKnowledgeBaseResponse = ApiRes<'/api/knowledge-bases/{kbId}', 'patch'>;
type KnowledgeBaseDto = NonNullable<UpdateKnowledgeBaseResponse['data']> & {
  userId?: number;
  enabledTemplatePluginIds?: string[] | null;
};

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`knowledge base update api 响应缺少字段: ${field}`);
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

export const knowledgeBaseUpdateApi = {
  update: async (
    kbId: string,
    payload: KnowledgeBaseUpdatePayload,
    projectId: string
  ): Promise<{ item: KnowledgeBase; message: string }> => {
    const response = await apiRequest<UpdateKnowledgeBaseResponse>(`/knowledge-bases/${kbId}`, {
      method: 'PATCH',
      params: {
        projectId,
      } satisfies UpdateKnowledgeBaseQuery,
      body: {
        name: payload.name,
        description: payload.description ?? undefined,
        tags: payload.tags ?? [],
        visibility: payload.visibility,
      } satisfies UpdateKnowledgeBaseRequest,
    });
    return {
      item: mapKnowledgeBase(requiredField(response.data, 'data')),
      message: requiredField(response.message, 'message'),
    };
  },
};
