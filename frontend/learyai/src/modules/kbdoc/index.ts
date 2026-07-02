// modules/kbdoc 负责知识库文档具体能力的统一出口。
export { default as ResourceDetail } from './widgets/resource-detail';
export { ResourceVideoDetail } from './widgets/resource-detail';
export { default as ResourceGrid } from './widgets/resource-grid';
export { default as ResourceImportModal } from './widgets/resource-import';
export { ResourceImportTextModal } from './widgets/resource-import';
export { ResourceImportUrlModal } from './widgets/resource-import';
export { EditResourceAction } from './features';
export { resourceApi } from './entities/resource';
export {
  useKbdocList,
  useKbdocOptions,
  useResourceDetailByDocId,
  useDeleteResource,
  useUpdateResourceDetail,
} from './entities/resource';
export {
  useImagePreviewPagination,
} from './entities/resource';
export {
  useTextPreviewPagination,
} from './entities/resource';
export type { SidebarResource, ResourceFileKind } from './shared/types';
export type {
  ResourceDetail as KbdocResourceDetail,
  ResourceFileType,
  ResourceListItem,
  ResourceListResponse,
  ResourceOptionItem,
  ResourceTaskStatus,
} from './entities/resource';
