// modules/resource 作为资源中心模块统一出口，仅暴露本模块拥有的页面与状态能力。
export {
  ResourceCenterLayout,
  ResourceCenterPage,
} from './pages/resource-center';
export { default as ResourceDetailFullscreenPage } from './pages/resource-detail-fullscreen';
export {
  WORKSPACE_PATH,
  buildWorkspacePath,
  buildProjectDetailPath,
  buildProjectTemplateFullscreenPath,
  buildResourceCenterPath,
  buildResourceDetailFullscreenPath,
  buildResourceRouteState,
  resolveProjectDetailBackTarget,
  resolveProjectTemplateFullscreenBackTarget,
  resolveResourceCenterBackTarget,
  resolveResourceDetailFullscreenBackTarget,
} from './route';
export { resourceFlowCanvasApi } from './adapter/flow-canvas/model/effects/api';
export {
  requestCitationJump,
  requestAiPanelOpen,
  requestVideoJump,
  clearVideoJumpRequest,
  openImport,
  openImportUrl,
  closeImport,
  removeReferenceByDocId,
  renameReferenceResource,
  selectScopedDocNameMap,
  upsertDocNames,
  useDocName,
  useScopedDocNameMap,
} from './entities/resource-center';
export { default as resourceCenterReducer } from './entities/resource-center';
export { resolveDocReferenceState } from './entities/resource-center';
