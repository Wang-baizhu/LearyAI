// visitRecentApi 负责获取最近访问内容分页列表。
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiQuery, ApiRes } from '@/shared/api/contract';
import type { RecentVisitItem, RecentVisitPage } from '../../../entities';

type RecentVisitGeneratedResponse = ApiRes<'/api/visits/recent', 'get'>;
type RecentVisitPageDto = NonNullable<RecentVisitGeneratedResponse['data']>;
type RecentVisitItemDto = NonNullable<RecentVisitPageDto['items']>[number];
type RecentVisitQuery = ApiQuery<'/api/visits/recent', 'get'> extends never
  ? {
      size?: number;
      cursor?: string;
    }
  : ApiQuery<'/api/visits/recent', 'get'>;
type RecentVisitEnvelope = ApiEnvelope<RecentVisitPageDto>;

const requiredField = <T>(value: T | null | undefined, field: string): T => {
  if (value === null || value === undefined) {
    throw new Error(`visit recent api 响应缺少字段: ${field}`);
  }
  return value;
};

const mapResourceType = (value: RecentVisitItemDto['resourceType']): RecentVisitItem['resourceType'] => {
  const resourceType = requiredField(value, 'items[].resourceType');
  if (resourceType !== 'PROJECT' && resourceType !== 'KB') {
    throw new Error(`visit recent api 响应字段非法: items[].resourceType=${resourceType}`);
  }
  return resourceType;
};

const mapItem = (dto: RecentVisitItemDto): RecentVisitItem => ({
  resourceType: mapResourceType(dto.resourceType),
  resourceId: requiredField(dto.resourceId, 'items[].resourceId'),
  visitedAt: dto.visitedAt ?? null,
  available: requiredField(dto.available, 'items[].available'),
  title: dto.title ?? null,
  description: dto.description ?? null,
  projectId: dto.projectId ?? null,
  kbId: dto.kbId ?? null,
});

export const visitRecentApi = {
  fetchRecent: async (size = 20, cursor?: string): Promise<RecentVisitPage> => {
    const response = await apiRequest<RecentVisitEnvelope>('/visits/recent', {
      params: {
        size,
        cursor,
      } satisfies RecentVisitQuery,
    });
    return {
      items: (response.data.items ?? []).map(mapItem),
      hasMore: requiredField(response.data.hasMore, 'hasMore'),
      nextCursor: response.data.nextCursor ?? null,
    };
  },
};
