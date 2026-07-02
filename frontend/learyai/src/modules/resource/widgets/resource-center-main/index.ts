// modules/resource/widgets/resource-center-main 对外统一出口，收敛 slice 间依赖路径。
export type { ResourceCenterAiState, ResourceCenterAiViewProps, ResourceCenterContentVariant, ResourceCenterDetailRegionProps, ResourceCenterListActions, ResourceCenterListViewProps } from './model/types';
export { default as ResourceCenterAiView } from './ui/ResourceCenterAiView';

export { default as ResourceCenterContent } from './ui/ResourceCenterContent';
export type { ResourceCenterListState } from './ui/ResourceCenterContent';
export { default as ResourceCenterDetailRegion } from './ui/ResourceCenterDetailRegion';

export { default as ResourceCenterListView } from './ui/ResourceCenterListView';

