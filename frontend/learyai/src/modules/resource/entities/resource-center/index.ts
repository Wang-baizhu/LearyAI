// modules/resource/entities/resource-center 对外统一出口，收敛 slice 间依赖路径。
export { default } from './model/store/slice';
export { clearStoredReferenceState, getStoredReferenceState, resolveDocReferenceState, setStoredReferenceState } from './model/effects/referenceStorage';
export { openResourceCenterDetail, openResourceCenterResourceDetail, openResourceCenterTemplateDetail, openResourceCenterVideoDetail } from './lib/detailOpen';
export { findReferenceBySource, mapListItemToReference, mapListItemToSidebarResource, mapReferenceToSidebarResource, selectReferencedResourcesByContext } from './model/selectors/reference';
export { selectScopedDocNameMap, useDocName, useScopedDocNameMap } from './model/selectors/docNames';
export { RESOURCE_CENTER_PANEL_META, RESOURCE_CENTER_SECTION_CONFIGS } from './model/selectors/sectionConfig';
export type { ResourceCenterResourceKind, ResourceCenterSectionConfig, ResourceCenterSectionKey } from './model/selectors/sectionConfig';
export { default as slice } from './model/store/slice';
export { addReference, buildReferenceScopeKey, clearCitationJump, clearCurrentContext, clearDocNames, clearReferences, clearVideoJumpRequest, closeImport, openImport, openImportText, openImportUrl, removeReferenceByDocId, renameReferenceResource, requestAiPanelOpen, requestCitationJump, requestVideoJump, setCurrentContext, setFileType, setPage, setReferencedResources, setSearch, setSelectedTemplateSource, setSelectedTemplateTag, setSize, toggleReference, upsertDocNames } from './model/store/slice';
export type { ReferenceResource, ReferenceScopeContext, ResourceFileTypeFilter, TemplateTagTab } from './model/store/slice';
export { DETAIL_GROUP_DRAG_ID_PREFIX, DETAIL_MERGE_DROP_ZONE_PREFIX, isDetailTabKey, isResourceCenterTab, RESOURCE_CENTER_TAB_KEYS, SIDEBAR_TAB_DROP_ZONE_ID } from './model/types/panel';
export type { ResourceCenterDetailKind, ResourceCenterDetailTab, ResourceCenterDetailTabKey, ResourceCenterPanel, ResourceCenterStaticPanel, ResourceCenterTab, ResourceCenterTabItem } from './model/types/panel';
export type { ResourceCenterDetailOpenHandler, ResourceCenterDetailOpenPayload } from './lib/detailOpen';
export type { ResourceDetailPanelProps, WhiteboardDetailConfig } from './model/types/view';
export { ResourceScopeProvider } from './model/resourceScope.tsx';
export { useResourceScope } from './model/resourceScope';
export type { ResourceScopeValue } from './model/resourceScope';
