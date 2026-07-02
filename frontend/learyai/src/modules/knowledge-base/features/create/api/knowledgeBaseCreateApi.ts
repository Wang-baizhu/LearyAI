// knowledgeBaseCreateApi 负责新建知识库接口调用与数据映射。
import { apiRequest } from '@/shared/api/client';
import type { ApiReq, ApiRes } from '@/shared/api/contract';
import type { KnowledgeBase, KnowledgeBaseVisibility } from '../../../entities';

export interface KnowledgeBaseCreatePayload {
  name: string;
  description?: string | null;
  tags?: string[];
  enabledTemplatePluginIds?: string[];
  projectId: string;
  visibility?: KnowledgeBaseVisibility;
}

type CreateKnowledgeBaseRequest = ApiReq<'/api/knowledge-bases', 'post'>;
type CreateKnowledgeBaseResponse = ApiRes<'/api/knowledge-bases', 'post'>;
type KnowledgeBaseDto = NonNullable<CreateKnowledgeBaseResponse['data']> & {
  userId?: number;
  enabledTemplatePluginIds?: string[] | null;
};

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`knowledge base create api 响应缺少字段: ${field}`);
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

export const knowledgeBaseCreateApi = {
  create: async (payload: KnowledgeBaseCreatePayload): Promise<{ item: KnowledgeBase; message: string }> => {
    const response = await apiRequest<CreateKnowledgeBaseResponse>('/knowledge-bases', {
      method: 'POST',
      body: {
        name: payload.name,
        description: payload.description ?? undefined,
        tags: payload.tags ?? [],
        projectId: payload.projectId,
        visibility: payload.visibility ?? 'PRIVATE',
      } satisfies CreateKnowledgeBaseRequest,
    });
    return {
      item: mapKnowledgeBase(requiredField(response.data, 'data')),
      message: requiredField(response.message, 'message'),
    };
  },
};
