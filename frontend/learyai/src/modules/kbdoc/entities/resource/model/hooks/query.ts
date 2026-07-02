// query 负责封装知识库资源的 TanStack Query hooks。
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { resourceApi, type ResourceListParams, type ResourceOptionsParams } from '../effects/api';
import type {
  ResourceDetail,
  ResourceListItem,
  ResourceListResponse,
  ResourceOptionItem,
  UpdateResourceDetailPayload,
} from '../types';

const resourceKeys = {
  recent: (projectId?: string) => ['resource', 'recent', projectId ?? 'none'] as const,
  list: (params: ResourceListParams) => ['resource', 'list', params] as const,
  options: (params: ResourceOptionsParams) => ['resource', 'options', params] as const,
  detail: (docId: string, projectId?: string) => ['resource', 'detail', docId, projectId ?? 'none'] as const,
};

const fetchRecentResources = async (limit = 10, projectId?: string): Promise<ResourceListItem[]> => {
  const ids = await resourceApi.getRecentResourceIds(limit, projectId);
  const items = await Promise.all(
    ids.map(async (docId) => {
      const found = await resourceApi.getResourceByDocId(docId, undefined, projectId);
      return found;
    })
  );
  return items.filter(Boolean) as ResourceListItem[];
};

export const useRecentResources = (limit = 10, projectId?: string) =>
  useQuery({
    queryKey: resourceKeys.recent(projectId),
    queryFn: () => fetchRecentResources(limit, projectId),
    enabled: Boolean(projectId),
  });

export const useKbdocList = (
  params: ResourceListParams,
  options?: { enabled?: boolean }
) =>
  useQuery({
    queryKey: resourceKeys.list(params),
    queryFn: () => resourceApi.getResourceList(params),
    enabled: Boolean(params.projectId) && (options?.enabled ?? true),
  });

export const useKbdocOptions = (params: ResourceOptionsParams) =>
  useQuery<ResourceOptionItem[]>({
    queryKey: resourceKeys.options(params),
    queryFn: () => resourceApi.getResourceOptions(params),
    enabled: Boolean(params.projectId),
  });

export const useResourceDetailByDocId = (docId?: string | null, kbId?: string, projectId?: string) =>
  useQuery<ResourceDetail | null>({
    queryKey: docId
      ? resourceKeys.detail(`${docId}-${kbId ?? 'all'}`, projectId)
      : ['resource', 'detail', 'empty', projectId ?? 'none'],
    queryFn: async () => {
      if (!docId) return null;
      return resourceApi.getResourceDetail(docId, projectId);
    },
    enabled: Boolean(docId) && Boolean(projectId),
  });

type DeleteResourcePayload = {
  docId: string;
};

const pruneListResponse = (data: ResourceListResponse | undefined, docId: string) => {
  if (!data) return data;
  const nextItems = data.items.filter((item) => item.docId !== docId);
  if (nextItems.length === data.items.length) return data;
  const nextTotal = Math.max(0, data.total - (data.items.length - nextItems.length));
  return { ...data, items: nextItems, total: nextTotal };
};

export const useDeleteResource = (projectId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ docId }: DeleteResourcePayload) => resourceApi.deleteResource(docId, projectId),
    onSuccess: (_response, variables) => {
      queryClient.invalidateQueries({ queryKey: ['resource'] });

      // 立即从缓存列表中移除已删除资源，避免旧列表反向同步引用状态。
      const targetDocId = variables.docId;
      queryClient.setQueriesData<ResourceListResponse>(
        { queryKey: ['resource', 'list'] },
        (data) => pruneListResponse(data, targetDocId)
      );
      queryClient.setQueriesData<ResourceListItem[]>(
        { queryKey: ['resource', 'recent'] },
        (data) => data?.filter((item) => item.docId !== targetDocId) ?? data
      );
      queryClient.removeQueries({
        queryKey: ['resource', 'detail'],
        predicate: (query) => {
          const key = query.queryKey;
          return (
            key[0] === 'resource'
            && key[1] === 'detail'
            && typeof key[2] === 'string'
            && key[2].startsWith(targetDocId)
          );
        },
      });
    },
  });
};

type UpdateResourcePayload = {
  docId: string;
  payload: UpdateResourceDetailPayload;
};

const matchesProjectScopedResourceQuery = (queryKey: readonly unknown[], projectId: string) => {
  if (queryKey[0] !== 'resource') return false;
  if (queryKey[1] === 'list' || queryKey[1] === 'options') {
    const params = queryKey[2];
    return typeof params === 'object'
      && params !== null
      && 'projectId' in params
      && (params as { projectId?: string }).projectId === projectId;
  }
  if (queryKey[1] === 'recent') {
    return queryKey[2] === projectId;
  }
  if (queryKey[1] === 'detail') {
    return queryKey[3] === projectId;
  }
  return false;
};

const patchListItemName = (data: ResourceListResponse | undefined, docId: string, name: string) => {
  if (!data) return data;
  return {
    ...data,
    items: data.items.map((item) => (item.docId === docId ? { ...item, name } : item)),
  };
};

export const useUpdateResourceDetail = (projectId?: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ docId, payload }: UpdateResourcePayload) => {
      if (!projectId) {
        throw new Error('缺少 projectId，无法更新资源');
      }
      return resourceApi.updateResourceDetail(docId, projectId, payload);
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['resource'] });
      if (!projectId) {
        return;
      }
      queryClient.setQueriesData<ResourceListResponse>(
        {
          queryKey: ['resource', 'list'],
          predicate: (query) => matchesProjectScopedResourceQuery(query.queryKey, projectId),
        },
        (data) => patchListItemName(data, updated.docId, updated.name)
      );
      queryClient.setQueriesData<ResourceListItem[]>(
        {
          queryKey: ['resource', 'recent'],
          predicate: (query) => matchesProjectScopedResourceQuery(query.queryKey, projectId),
        },
        (data) => data?.map((item) => (item.docId === updated.docId ? { ...item, name: updated.name } : item)) ?? data
      );
      queryClient.setQueriesData<ResourceOptionItem[]>(
        {
          queryKey: ['resource', 'options'],
          predicate: (query) => matchesProjectScopedResourceQuery(query.queryKey, projectId),
        },
        (data) => data?.map((item) => (item.docId === updated.docId ? { ...item, name: updated.name } : item)) ?? data
      );
      queryClient.setQueriesData<ResourceDetail | null>(
        {
          queryKey: ['resource', 'detail'],
          predicate: (query) => matchesProjectScopedResourceQuery(query.queryKey, projectId),
        },
        (data) => (data?.docId === updated.docId ? updated : data)
      );
    },
  });
};
