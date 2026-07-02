// documentationTree 负责兼容 resource-detail 历史路径，实际实现已下沉到 entities/resource/lib。
export {
  buildDocumentationCitationPayload,
  collectExpandedNodeIds,
  filterDocumentationNodes,
  formatPageValue,
  parseDocumentationTree,
  type DocumentationCitationPayload,
} from '../../../entities/resource';
