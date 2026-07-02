// modules/resource/features/resource-center-list 对外统一出口，收敛 slice 间依赖路径。
export { default } from './model/useResourceCenterListState';
export type { ResourceCenterListState } from './model/types';
export { default as useResourceCenterListState } from './model/useResourceCenterListState';

