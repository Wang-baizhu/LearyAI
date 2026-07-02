// types 负责定义知识库资源实体与上传相关类型。
export interface DocumentationNode {
  id: string;
  title: string;
  summary: string;
  page_start: number;
  page_end: number;
  children: DocumentationNode[];
}

export interface DocumentationTree {
  version: number;
  nodes: DocumentationNode[];
}

export type ResourceFileType =
  | 'pdf'
  | 'docx'
  | 'pptx'
  | 'md'
  | 'txt'
  | 'url'
  | 'wav'
  | 'mp3'
  | 'm4a'
  | 'aac'
  | 'flac'
  | 'ogg'
  | 'other';
export type ResourceTaskStatus = 'UPLOADING' | 'UPLOADED' | 'PROCESSING' | 'DONE' | 'FAILED';

export interface ResourceListItem {
  docId: string;
  name: string;
  fileType: ResourceFileType;
  size: number;
  previewUrl?: string | null;
  createdAt: string;
  status: ResourceTaskStatus;
}

export interface ResourceDetail {
  docId: string;
  name: string;
  fileType: ResourceFileType;
  size: number;
  previewUrl?: string | null;
  createdAt: string;
  objectKey?: string | null;
  storageProvider?: string | null;
  originUrl?: string | null;
  metadata?: {
    description?: string | null;
    summary?: string | null;
    tag?: string | null;
    documentation?: DocumentationTree | null;
    total_page?: number | null;
  } | null;
  updatedAt?: string | null;
}

export interface ResourceListResponse {
  items: ResourceListItem[];
  total: number;
  page: number;
  size: number;
}

export interface ResourceOptionItem {
  docId: string;
  name: string;
  status: ResourceTaskStatus;
}

export interface UploadPreparePayload {
  docId?: string;
  fileType: ResourceFileType;
  size: number;
  hash?: string;
  purpose?: 'UPLOAD' | 'PREVIEW';
  projectId: string;
}

export interface UploadPrepareResponse {
  docId: string;
  taskId: string;
  objectKey: string;
  uploadPolicy?: {
    provider?: string;
    uploadUrl?: string;
    method?: string;
    headers?: Record<string, string>;
    fields?: Record<string, string>;
    expiresAt?: string;
  };
  tempUrl?: string;
  tempUrlExpiresAt?: string;
}

export interface UploadConfirmPayload {
  docId: string;
  objectKey: string;
  kbId: string;
  etag?: string;
  size?: number;
  name?: string;
  projectId: string;
}

export interface UploadConfirmResponse {
  taskId: string;
  status: string;
}

export interface UrlImportPayload {
  projectId: string;
  kbId: string;
  url: string;
  name?: string;
}

export interface UrlImportResponse {
  docId: string;
  taskId: string;
  status: string;
}

export interface TextImportPayload {
  projectId: string;
  kbId: string;
  text: string;
  name?: string;
}

export interface TextImportResponse {
  docId: string;
  taskId: string;
  status: string;
}

export interface PreviewCredentialsResponse {
  provider?: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: string;
  endpoint: string;
  bucket: string;
  prefix: string;
}

export interface UpdateResourceDetailPayload {
  name: string;
  description?: string | null;
  documentation?: DocumentationTree | null;
}
