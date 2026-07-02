// modules/resource/adapter 负责聚合资源中心内部使用的跨模块适配能力。
export { useResourceCatalog } from './catalog/model/hooks/useResourceCatalog';
export { useResourceCenterDetailState } from './detail/model/hooks/useResourceCenterDetailState';
export { resolveReferenceTarget } from './reference-source/lib/resolveReferenceTarget';
export type { ReferenceSourceItem, ReferenceSourceTarget } from './reference-source/model/types';
