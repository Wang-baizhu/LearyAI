// api 负责对接知识库资源相关后端接口。
import { ensureTaskSseReady } from './taskSse';
import { apiRequest } from '@/shared/api/client';
import type { ApiEnvelope, ApiQuery, ApiReq, ApiRes } from '@/shared/api/contract';
import { refetchActiveTaskList } from '@/shared/query/taskListRefetch';
import type {
  DocumentationTree,
  PreviewCredentialsResponse,
  ResourceDetail,
  ResourceListItem,
  ResourceListResponse,
  ResourceOptionItem,
  TextImportPayload,
  TextImportResponse,
  UploadConfirmResponse,
  UploadPrepareResponse,
  UpdateResourceDetailPayload,
  UrlImportPayload,
  UrlImportResponse,
} from '../types';

export type ResourceListParams = Partial<ApiQuery<'/api/kb/docs', 'get'>>;

export type ResourceOptionsParams = Partial<ApiQuery<'/api/kb/docs/options', 'get'>>;

type RecentResourceIdsApiResponse = ApiRes<'/api/kb/recent', 'get'>;
type ResourceListApiResponse = ApiRes<'/api/kb/docs', 'get'>;
type ResourceOptionsApiResponse = ApiRes<'/api/kb/docs/options', 'get'>;
type ResourceDetailApiResponse = ApiRes<'/api/kb/docs/{docId}', 'get'>;
type UpdateResourceDetailApiPayload = ApiReq<'/api/kb/docs/{docId}', 'patch'>;
type UpdateResourceDetailApiResponse = ApiRes<'/api/kb/docs/{docId}', 'patch'>;
type UploadPreparePayload = ApiReq<'/api/kb/docs/upload/prepare', 'post'>;
type UploadPrepareApiResponse = ApiRes<'/api/kb/docs/upload/prepare', 'post'>;
type UploadConfirmPayload = ApiReq<'/api/kb/docs/upload/confirm', 'post'>;
type UploadConfirmApiResponse = ApiRes<'/api/kb/docs/upload/confirm', 'post'>;
type DeleteResourceApiResponse = ApiRes<'/api/kb/docs/{docId}', 'delete'>;
type PreviewCredentialsPayload = ApiReq<'/api/kb/docs/preview/credentials', 'post'>;
type PreviewCredentialsApiResponse = ApiRes<'/api/kb/docs/preview/credentials', 'post'>;

const unwrapResponse = <T>(response: Pick<Partial<ApiEnvelope<T>>, 'data'>) => response.data;

const toDocumentationRequestPayload = (
  documentation: DocumentationTree
): NonNullable<UpdateResourceDetailApiPayload['documentation']> => (
  documentation as unknown as NonNullable<UpdateResourceDetailApiPayload['documentation']>
);

export const resolveUploadTempUrl = (prepare: UploadPrepareResponse): string => {
  const url = prepare.tempUrl?.trim();
  if (!url) {
    throw new Error('未获取到临时上传地址（tempUrl）');
  }
  return url;
};

export const resolveUploadContentType = (prepare: UploadPrepareResponse, fallback: string): string => {
  const headers = prepare.uploadPolicy?.headers;
  if (headers) {
    const headerValue = headers['Content-Type'] ?? headers['content-type'];
    if (typeof headerValue === 'string' && headerValue.trim()) {
      return headerValue.trim();
    }
  }
  const normalizedFallback = fallback?.trim();
  return normalizedFallback || 'application/octet-stream';
};

export const resourceApi = {
  getRecentResourceIds: async (limit = 10, projectId?: string) => {
    const params: Partial<ApiQuery<'/api/kb/recent', 'get'>> = { limit, projectId };
    const response = await apiRequest<RecentResourceIdsApiResponse>('/kb/recent', {
      params,
    });
    return unwrapResponse(response) as string[];
  },
  getResourceList: async (params: ResourceListParams) => {
    const response = await apiRequest<ResourceListApiResponse>('/kb/docs', {
      params,
    });
    return unwrapResponse(response) as ResourceListResponse;
  },
  getResourceOptions: async (params: ResourceOptionsParams) => {
    const response = await apiRequest<ResourceOptionsApiResponse>('/kb/docs/options', {
      params,
    });
    return unwrapResponse(response) as ResourceOptionItem[];
  },
  getResourceDetail: async (docId: string, projectId?: string) => {
    const params: Partial<ApiQuery<'/api/kb/docs/{docId}', 'get'>> = { projectId };
    const response = await apiRequest<ResourceDetailApiResponse>(`/kb/docs/${docId}`, {
      params,
    });
    return unwrapResponse(response) as ResourceDetail;
  },
  updateResourceDetail: async (docId: string, projectId: string, payload: UpdateResourceDetailPayload) => {
    const body: UpdateResourceDetailApiPayload = {
      projectId,
      name: payload.name,
      description: payload.description ?? undefined,
      documentation: payload.documentation ? toDocumentationRequestPayload(payload.documentation) : undefined,
    };
    const response = await apiRequest<UpdateResourceDetailApiResponse>(`/kb/docs/${docId}`, {
      method: 'PATCH',
      body,
    });
    return unwrapResponse(response) as ResourceDetail;
  },
  getResourceByDocId: async (
    docId: string,
    kbId?: string,
    projectId?: string
  ): Promise<ResourceListItem | null> => {
    const response = await resourceApi.getResourceList({
      search: docId,
      page: 1,
      size: 1,
      kbId,
      projectId,
    });
    return response.items?.[0] ?? null;
  },
  prepareUpload: async (payload: UploadPreparePayload) => {
    if (!payload.kbId) {
      throw new Error('缺少知识库ID，无法准备上传');
    }
    if (!payload.projectId) {
      throw new Error('缺少项目ID，无法准备上传');
    }
    const response = await apiRequest<UploadPrepareApiResponse>('/kb/docs/upload/prepare', {
      method: 'POST',
      body: payload,
    });
    return unwrapResponse(response) as UploadPrepareResponse;
  },
  confirmUpload: async (payload: UploadConfirmPayload) => {
    if (!payload.kbId) {
      throw new Error('缺少知识库ID，无法确认上传');
    }
    if (!payload.projectId) {
      throw new Error('缺少项目ID，无法确认上传');
    }
    try {
      await ensureTaskSseReady(payload.projectId, payload.kbId, 10000);
    } catch (error) {
      console.warn('[TaskSSE] init failed', error);
      throw new Error('SSE 连接失败，请稍后重试');
    }
    const response = await apiRequest<UploadConfirmApiResponse>('/kb/docs/upload/confirm', {
      method: 'POST',
      body: payload,
    });
    void refetchActiveTaskList(payload.projectId, payload.kbId);
    return unwrapResponse(response) as UploadConfirmResponse;
  },
  importUrl: async (payload: UrlImportPayload) => {
    if (!payload.kbId) {
      throw new Error('缺少知识库ID，无法导入链接');
    }
    if (!payload.projectId) {
      throw new Error('缺少项目ID，无法导入链接');
    }
    try {
      await ensureTaskSseReady(payload.projectId, payload.kbId, 10000);
    } catch (error) {
      console.warn('[TaskSSE] init failed', error);
      throw new Error('SSE 连接失败，请稍后重试');
    }
    const response = await apiRequest<{ code: string; message: string; data: UrlImportResponse }>('/kb/docs/import/url', {
      method: 'POST',
      body: payload,
    });
    void refetchActiveTaskList(payload.projectId, payload.kbId);
    return unwrapResponse(response) as UrlImportResponse;
  },
  importText: async (payload: TextImportPayload) => {
    if (!payload.kbId) {
      throw new Error('缺少知识库ID，无法导入文本');
    }
    if (!payload.projectId) {
      throw new Error('缺少项目ID，无法导入文本');
    }
    if (!payload.text.trim()) {
      throw new Error('请输入文本内容');
    }
    try {
      await ensureTaskSseReady(payload.projectId, payload.kbId, 10000);
    } catch (error) {
      console.warn('[TaskSSE] init failed', error);
      throw new Error('SSE 连接失败，请稍后重试');
    }
    const response = await apiRequest<{ code: string; message: string; data: TextImportResponse }>('/kb/docs/import/text', {
      method: 'POST',
      body: payload,
    });
    void refetchActiveTaskList(payload.projectId, payload.kbId);
    return unwrapResponse(response) as TextImportResponse;
  },
  deleteResource: async (docId: string, projectId?: string) => {
    const params: Partial<ApiQuery<'/api/kb/docs/{docId}', 'delete'>> = { projectId };
    const response = await apiRequest<DeleteResourceApiResponse>(`/kb/docs/${docId}`, {
      method: 'DELETE',
      params,
    });
    return unwrapResponse(response) as boolean;
  },
  getPreviewCredentials: async (docId: string, projectId?: string) => {
    const body: PreviewCredentialsPayload = { docId, projectId };
    const response = await apiRequest<PreviewCredentialsApiResponse>('/kb/docs/preview/credentials', {
      method: 'POST',
      body,
    });
    return unwrapResponse(response) as PreviewCredentialsResponse;
  },
};
