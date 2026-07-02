// modules/kbdoc/entities/resource 对外统一出口，收敛 slice 间依赖路径。
export { buildDocumentationCitationPayload, collectExpandedNodeIds, filterDocumentationNodes, formatPageValue, parseDocumentationTree } from './lib/documentationTree';
export type { DocumentationCitationPayload } from './lib/documentationTree';
export { resolveUploadContentType, resolveUploadTempUrl, resourceApi } from './model/effects/api';
export type { ResourceListParams, ResourceOptionsParams } from './model/effects/api';
export { getPreviewCredentials } from './model/effects/previewCredentials';
export { clearPreviewImageCacheForDoc, fetchPreviewImagesPage } from './model/effects/previewImages';
export type { PreviewImagePage } from './model/effects/previewImages';
export { buildObjectKey, isOssProvider, normalizePrefix } from './model/effects/previewObjectReader';
export type { PreviewObjectReader } from './model/effects/previewObjectReader';
export { createAwsPreviewReader } from './model/effects/previewObjectReaderAws';
export { createOssPreviewReader } from './model/effects/previewObjectReaderOss';
export { fetchTextChunksPage } from './model/effects/textChunks';
export type { TextChunkItem, TextChunkPage } from './model/effects/textChunks';
export { useDeleteResource, useKbdocList, useKbdocOptions, useRecentResources, useResourceDetailByDocId, useUpdateResourceDetail } from './model/hooks/query';
export type { DocumentationNode, DocumentationTree, PreviewCredentialsResponse, ResourceDetail, ResourceFileType, ResourceListItem, ResourceListResponse, ResourceOptionItem, ResourceTaskStatus, TextImportPayload, TextImportResponse, UpdateResourceDetailPayload, UploadConfirmPayload, UploadConfirmResponse, UploadPreparePayload, UploadPrepareResponse, UrlImportPayload, UrlImportResponse } from './model/types';
export { useImagePreviewPagination } from './model/hooks/useImagePreviewPagination';
export { useTextPreviewPagination } from './model/hooks/useTextPreviewPagination';
